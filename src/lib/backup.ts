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
import { buildSnapshot, normalizeSnapshot, restoreSnapshot } from './snapshot';
import { remapSnapshotIds } from './backup-remap';
import { countBackupRows, countWorldRows, readWorldMeta, rebindWorld } from './backup-world';
import { getSetting, setSetting, tx } from './db/sqlite';

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
 * 导入备份：覆盖当前世界观的内容。
 *
 * 三条保证（都是踩过坑之后加的）：
 *  1. **原子**：整体包在一个事务里。旧数据只在同一个事务里被替换，
 *     中途任何一步失败都整体回滚 —— 绝不会出现「原数据被清空、新数据没写进去」。
 *  2. **自校验**：写完后按 world_id 统计行数，与备份里的行数比对，
 *     不一致就直接抛错触发回滚（宁可导入失败，也不能假装成功）。
 *  3. **不静默**：失败时把 SQLite 的原始错误带出去，由 UI 翻译成人话。
 *
 * 为什么要按 world_id 统计而不是「查全库」：导入的是**别的世界观**导出的文件，
 * 文件里的 world_id 是来源世界的；如果没改写成功，行数统计会立刻发现
 * （这正是 0.1.0 安装包「提示导入完成但一条数据都没有」的根因）。
 *
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

  // 旧版本导出的文件可能缺少后加的数据段（如 cardAssets），先补齐再重映射，
  // 否则 idMap 会在 undefined 上遍历报错。
  const payload = rebindWorld(remapSnapshotIds(normalizeSnapshot(backup.snapshot)), worldId);
  const expected = countBackupRows(payload);

  tx(() => {
    restoreSnapshot(worldId, payload);
    const actual = countWorldRows(worldId);
    if (actual !== expected) {
      throw new Error(
        `导入校验未通过：期望 ${expected} 行，实际写入 ${actual} 行（已回滚，你的数据没有被改动）`,
      );
    }
    // 世界观本身的那一行不在快照还原范围内（版本回滚不该改名字），
    // 但导入是「我把这套设定搬过来」的意思：文件里的简介与时间轴口径应一起带过来，
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
  });

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
