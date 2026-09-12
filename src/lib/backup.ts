/**
 * 备份与恢复
 * ------------------------------------------------------------------
 * 本地优先软件必须让用户能随时把数据带走：
 *  - 导出设定：JSON（卡片/地图/时间轴/文稿…）；
 *  - 导出完整备份：额外内嵌图片（base64），便于换设备；
 *  - 导入：自动写回资源库与数据库。
 */
import type { Asset, SnapshotPayload } from '@/types';
import { assetsRepo } from './db/tables';
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
  restoreSnapshot(worldId, backup.snapshot);
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
