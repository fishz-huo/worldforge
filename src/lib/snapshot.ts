/**
 * 版本快照：生成与还原
 * ------------------------------------------------------------------
 * 需求 12：保存某一版设定 → 多次修改 → 随时调出与当前对比。
 * 快照是「当前世界观全部结构化内容」的 JSON，不含图片二进制
 * （图片以资源 id 引用，还原时只要资源还在就能继续显示）。
 */
import type { SnapshotPayload } from '@/types';
import {
  branchesRepo, cardsRepo, docsRepo, entriesRepo, erasRepo, mapsRepo, outlineRepo,
  pinsRepo, regionsRepo, relationsRepo, tagsRepo, tracksRepo, worldsRepo, listAllCardTags, run, tx,
} from './db';

/** 快照格式版本 */
export const SNAPSHOT_VERSION = 1;

/** 生成快照 */
export function buildSnapshot(worldId: string): SnapshotPayload {
  return {
    schemaVersion: SNAPSHOT_VERSION,
    world: worldsRepo.get(worldId) ?? null,
    branches: branchesRepo.list('world_id = ?', [worldId]),
    cards: cardsRepo.list('world_id = ?', [worldId]),
    tags: tagsRepo.list('world_id = ?', [worldId]),
    cardTags: listAllCardTags(worldId),
    relations: relationsRepo.list('world_id = ?', [worldId]),
    maps: mapsRepo.list('world_id = ?', [worldId]),
    pins: pinsRepo.list('map_id IN (SELECT id FROM maps WHERE world_id = ?)', [worldId]),
    regions: regionsRepo.list('map_id IN (SELECT id FROM maps WHERE world_id = ?)', [worldId]),
    tracks: tracksRepo.list('world_id = ?', [worldId]),
    entries: entriesRepo.list('world_id = ?', [worldId]),
    eras: erasRepo.list('world_id = ?', [worldId]),
    docs: docsRepo.list('world_id = ?', [worldId]),
    outlineNodes: outlineRepo.list('doc_id IN (SELECT id FROM docs WHERE world_id = ?)', [worldId]),
  };
}

/**
 * 清空某个世界观的内容表。
 * 注意：不删除 assets 表（图片元数据不在快照里，删了就找不回来了），
 * 也不删除 versions 表（历史版本必须保留）。
 */
export function clearWorldContent(worldId: string): void {
  tx(() => {
    run('DELETE FROM card_tags WHERE card_id IN (SELECT id FROM cards WHERE world_id = ?)', [worldId]);
    run('DELETE FROM card_assets WHERE card_id IN (SELECT id FROM cards WHERE world_id = ?)', [worldId]);
    run('DELETE FROM relations WHERE world_id = ?', [worldId]);
    run('DELETE FROM cards WHERE world_id = ?', [worldId]);
    run('DELETE FROM tags WHERE world_id = ?', [worldId]);
    run('DELETE FROM map_pins WHERE map_id IN (SELECT id FROM maps WHERE world_id = ?)', [worldId]);
    run('DELETE FROM map_regions WHERE map_id IN (SELECT id FROM maps WHERE world_id = ?)', [worldId]);
    run('DELETE FROM maps WHERE world_id = ?', [worldId]);
    run('DELETE FROM timeline_entries WHERE world_id = ?', [worldId]);
    run('DELETE FROM tracks WHERE world_id = ?', [worldId]);
    run('DELETE FROM eras WHERE world_id = ?', [worldId]);
    run('DELETE FROM outline_nodes WHERE doc_id IN (SELECT id FROM docs WHERE world_id = ?)', [worldId]);
    run('DELETE FROM docs WHERE world_id = ?', [worldId]);
    run('DELETE FROM branches WHERE world_id = ?', [worldId]);
  });
}

/** 还原快照：清空内容 + 写回快照，两者在同一个事务里，保证原子性 */
export function restoreSnapshot(worldId: string, payload: SnapshotPayload): void {
  // 外层 tx 与 clearWorldContent / saveMany 内部的事务可重入合并，
  // 因此中途出错会整体回滚，不会出现「清空了但没写回」的半成品状态。
  tx(() => {
    clearWorldContent(worldId);
    branchesRepo.saveMany(payload.branches as never[]);
    cardsRepo.saveMany(payload.cards as never[]);
    tagsRepo.saveMany(payload.tags as never[]);
    (payload.cardTags as { card_id: string; tag_id: string }[]).forEach((ct) => {
      run('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)', [ct.card_id, ct.tag_id]);
    });
    relationsRepo.saveMany(payload.relations as never[]);
    mapsRepo.saveMany(payload.maps as never[]);
    pinsRepo.saveMany(payload.pins as never[]);
    regionsRepo.saveMany(payload.regions as never[]);
    tracksRepo.saveMany(payload.tracks as never[]);
    entriesRepo.saveMany(payload.entries as never[]);
    erasRepo.saveMany(payload.eras as never[]);
    docsRepo.saveMany(payload.docs as never[]);
    outlineRepo.saveMany(payload.outlineNodes as never[]);
  });
}

/** 安全解析快照文本 */
export function parseSnapshot(text: string): SnapshotPayload | null {
  try {
    const payload = JSON.parse(text) as SnapshotPayload;
    if (!payload || typeof payload !== 'object') return null;
    // 补齐缺失数组，兼容旧版本快照
    const arrays: (keyof SnapshotPayload)[] = [
      'branches', 'cards', 'tags', 'cardTags', 'relations', 'maps', 'pins',
      'regions', 'tracks', 'entries', 'eras', 'docs', 'outlineNodes',
    ];
    arrays.forEach((key) => {
      if (!Array.isArray(payload[key])) (payload as unknown as Record<string, unknown>)[key] = [];
    });
    return payload;
  } catch {
    return null;
  }
}
