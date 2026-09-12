/**
 * Version Slice —— 设定版本快照
 * ------------------------------------------------------------------
 * 需求 12：对某一版设定存档，改了很多次之后仍能调出来与当前对比。
 * 快照范围：卡片、标签、关联、地图、时间轴、文稿、分支（不含图片二进制）。
 */
import { newVersionId } from '@/lib/id';
import { versionsRepo } from '@/lib/db';
import { buildSnapshot, parseSnapshot, restoreSnapshot } from '@/lib/snapshot';
import { removeById } from '../helpers';
import type { Slice } from '../types';

export interface VersionSlice {
  /** 保存当前设定为一个版本快照 */
  createVersion: (name: string, note?: string) => string;
  deleteVersion: (id: string) => void;
  /** 用某个历史版本覆盖当前设定（不可撤销，UI 需二次确认） */
  restoreVersion: (id: string) => void;
  /** 把某个版本的快照导出为独立 JSON 文件内容 */
  versionToJson: (id: string) => string | null;
}

export const createVersionSlice: Slice<VersionSlice> = (set, get) => ({
  createVersion: (name, note = '') => {
    const worldId = get().currentWorldId;
    if (!worldId) return '';
    const payload = buildSnapshot(worldId);
    const snapshot = JSON.stringify(payload);
    const version = {
      id: newVersionId(),
      world_id: worldId,
      name: name.trim() || `快照 ${new Date().toLocaleString('zh-CN')}`,
      note,
      snapshot,
      size: new Blob([snapshot]).size,
      created_at: Date.now(),
    };
    versionsRepo.save(version);
    set({ versions: [version, ...get().versions], selectedVersionId: version.id });
    get().toast(`已保存版本「${version.name}」`, 'success');
    return version.id;
  },

  deleteVersion: (id) => {
    versionsRepo.remove(id);
    set({
      versions: removeById(get().versions, id),
      selectedVersionId: get().selectedVersionId === id ? null : get().selectedVersionId,
    });
  },

  restoreVersion: (id) => {
    const worldId = get().currentWorldId;
    const version = get().versions.find((v) => v.id === id);
    if (!worldId || !version) return;
    const payload = parseSnapshot(version.snapshot);
    if (!payload) {
      get().toast('快照解析失败，可能已损坏', 'error');
      return;
    }
    restoreSnapshot(worldId, payload);
    get().reload();
    get().toast(`已还原到「${version.name}」`, 'success');
  },

  versionToJson: (id) => {
    const version = get().versions.find((v) => v.id === id);
    if (!version) return null;
    const payload = parseSnapshot(version.snapshot);
    return payload ? JSON.stringify(payload, null, 2) : null;
  },
});
