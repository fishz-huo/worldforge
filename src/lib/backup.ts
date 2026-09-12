/**
 * 备份与恢复
 * ------------------------------------------------------------------
 * 本地优先软件必须让用户能随时把数据带走：
 *  - 导出设定：JSON（卡片/地图/时间轴/文稿…）；
 *  - 导出完整备份：额外内嵌图片（base64），便于换设备；
 *  - 导入：自动写回资源库与数据库。
 */
import type { Asset, SnapshotPayload } from '@/types';
import { assetsRepo, worldsRepo } from './db/tables';
import { getAssetBlob, putAssetBlob } from './db/idb';
import { blobToDataUrl, dataUrlToBlob, importImageBlob } from './assets';
import { buildSnapshot, restoreSnapshot } from './snapshot';
import { getSetting, setSetting } from './db/sqlite';

/** 备份文件格式 */
export interface BackupFile {
  app: 'worldforge';
  version: string;
  schemaVersion: number;
  exportedAt: number;
  snapshot: SnapshotPayload;
  /** 图片：{ assetId, name, mime, dataUrl } */
  assets?: { id: string; name: string; mime: string; dataUrl: string }[];
}

/** 生成备份对象 */
export async function buildBackup(worldId: string, withAssets: boolean): Promise<BackupFile> {
  const snapshot = buildSnapshot(worldId);
  const backup: BackupFile = {
    app: 'worldforge',
    version: '0.1.0',
    schemaVersion: Number(getSetting('schemaVersion', 1)),
    exportedAt: Date.now(),
    snapshot,
  };
  if (withAssets) {
    const list = assetsRepo.list('world_id = ?', [worldId]);
    const assets: BackupFile['assets'] = [];
    for (const asset of list) {
      const blob = await getAssetBlob(asset.id);
      if (!blob) continue;
      assets.push({ id: asset.id, name: asset.name, mime: asset.mime, dataUrl: await blobToDataUrl(blob) });
    }
    backup.assets = assets;
  }
  return backup;
}

/** 导出为 JSON 文本 */
export async function exportBackupText(worldId: string, withAssets: boolean): Promise<string> {
  const backup = await buildBackup(worldId, withAssets);
  return JSON.stringify(backup, null, 2);
}

/** 解析备份文本 */
export function parseBackup(text: string): BackupFile | null {
  try {
    const data = JSON.parse(text) as BackupFile;
    if (data.app !== 'worldforge' || !data.snapshot) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * 把快照里的 world_id 全部改写成目标世界观。
 * 为什么需要：导出是按「当前世界观」做的，文件里带着来源世界的 id。
 * 如果直接写回，导入到别的世界观（例如新建一个空世界观再导入）时，
 * 所有行的 world_id 仍是来源世界的，reload 按当前世界筛选就一条都看不见 ——
 * 而导入前的确认框已经把当前世界观清空了，表现为「导入成功但数据全没了」。
 * 实体 id 保持原样（图片引用、关联、大纲父子关系都靠 id 对应，不能动）。
 *
 * 类型说明：SnapshotPayload 里的数组元素是 unknown（快照来自磁盘，形状不可信），
 * 所以这里只做「有 world_id 就改写」的形状判断，不做字段级校验 ——
 * 真正的校验在写库那一层（缺列/类型不对会抛 SQLite 错误并整体回滚）。
 */
function rebindWorld(payload: SnapshotPayload, worldId: string): SnapshotPayload {
  const rows = (list: unknown[]): unknown[] => list.map((row) => (
    row && typeof row === 'object' && 'world_id' in row
      ? { ...(row as Record<string, unknown>), world_id: worldId }
      : row
  ));
  const world = payload.world && typeof payload.world === 'object'
    ? { ...(payload.world as Record<string, unknown>), id: worldId }
    : payload.world;
  return {
    ...payload,
    world,
    branches: rows(payload.branches),
    cards: rows(payload.cards),
    tags: rows(payload.tags),
    relations: rows(payload.relations),
    maps: rows(payload.maps),
    tracks: rows(payload.tracks),
    entries: rows(payload.entries),
    eras: rows(payload.eras),
    docs: rows(payload.docs),
  };
}

/** 从快照里安全读出世界观那一行的名字 / 简介 / meta（形状不对时全部忽略） */
function readWorldMeta(payload: SnapshotPayload): { name: string; description: string; meta: unknown } | null {
  const world = payload.world;
  if (!world || typeof world !== 'object') return null;
  const row = world as Record<string, unknown>;
  return {
    name: typeof row.name === 'string' ? row.name : '',
    description: typeof row.description === 'string' ? row.description : '',
    meta: row.meta ?? {},
  };
}

/**
 * 导入备份：覆盖当前世界观的内容。
 * 图片会重新写入 IndexedDB（保留原 assetId，这样卡片引用不会断）。
 */
export async function importBackup(worldId: string, backup: BackupFile): Promise<{ assets: number }> {
  let count = 0;
  if (backup.assets?.length) {
    for (const item of backup.assets) {
      const blob = dataUrlToBlob(item.dataUrl);
      await putAssetBlob(item.id, blob);
      const existing = assetsRepo.get(item.id);
      const asset: Asset = {
        id: item.id,
        world_id: worldId,
        name: item.name,
        mime: item.mime,
        size: blob.size,
        width: existing?.width ?? 0,
        height: existing?.height ?? 0,
        kind: 'image',
        created_at: existing?.created_at ?? Date.now(),
      };
      assetsRepo.save(asset);
      count += 1;
    }
  }
  const payload = rebindWorld(backup.snapshot, worldId);
  restoreSnapshot(worldId, payload);
  // 世界观本身的那一行不在快照还原范围内（快照还原主要用于版本回滚，不该改名字），
  // 但导入是「我把这套设定搬过来」的意思：导出文件里的简介与时间轴口径应当一起带过来，
  // 否则跨世界观导入之后刻度单位、零点称呼都得手填一遍。
  const target = worldsRepo.get(worldId);
  const incoming = readWorldMeta(payload);
  if (target && incoming) {
    worldsRepo.save({
      ...target,
      name: incoming.name || target.name,
      description: incoming.description || target.description,
      meta: (incoming.meta ?? {}) as typeof target.meta,
      updated_at: Date.now(),
    });
  }
  return { assets: count };
}

/** 导入外部图片文件（用于批量补图） */
export async function importExternalImage(file: File, worldId: string) {
  return importImageBlob(file, worldId, file.name);
}

/** 记录最近一次备份时间 */
export function markBackupDone(): void {
  setSetting('lastBackupAt', Date.now());
}

/** 读取最近备份时间 */
export function lastBackupAt(): number {
  return Number(getSetting('lastBackupAt', 0));
}
