/**
 * 级联删除与数据重置
 * ------------------------------------------------------------------
 * SQLite 未开启外键约束，删除世界观时需要在事务里手动清理所有子表，
 * 否则会留下孤儿数据（会拖慢查询并污染后续导入）。
 */
import { tx, run, all } from './sqlite';

/** 被影响的世界观列表（供调用方清理图片二进制） */
export interface PurgeResult {
  assetIds: string[];
}

/** 删除一个世界观及其全部关联数据 */
export function purgeWorld(worldId: string): PurgeResult {
  const assetIds = all<{ id: string }>('SELECT id FROM assets WHERE world_id = ?', [worldId]).map(
    (r) => r.id,
  );
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
    run('UPDATE outline_nodes SET card_id = NULL WHERE card_id IN (SELECT id FROM cards WHERE world_id = ?)', [worldId]);
    run('DELETE FROM docs WHERE world_id = ?', [worldId]);
    run('DELETE FROM versions WHERE world_id = ?', [worldId]);
    run('DELETE FROM assets WHERE world_id = ?', [worldId]);
    run('DELETE FROM branches WHERE world_id = ?', [worldId]);
    run('DELETE FROM worlds WHERE id = ?', [worldId]);
  });
  return { assetIds };
}

/** 清空所有业务数据（保留插件与设置），用于「重置示例数据」 */
export function purgeEverything(): PurgeResult {
  const assetIds = all<{ id: string }>('SELECT id FROM assets').map((r) => r.id);
  tx(() => {
    const tables = [
      'card_tags', 'card_assets', 'relations', 'cards', 'tags', 'map_pins',
      'map_regions', 'maps', 'timeline_entries', 'tracks', 'eras',
      'outline_nodes', 'docs', 'versions', 'assets', 'branches', 'worlds',
    ];
    tables.forEach((t) => run(`DELETE FROM ${t}`));
  });
  return { assetIds };
}

/** 删除一张卡片并清理其所有引用 */
export function purgeCard(cardId: string): void {
  tx(() => {
    run('DELETE FROM card_tags WHERE card_id = ?', [cardId]);
    run('DELETE FROM card_assets WHERE card_id = ?', [cardId]);
    run('DELETE FROM relations WHERE from_id = ? OR to_id = ?', [cardId, cardId]);
    run('DELETE FROM timeline_entries WHERE card_id = ?', [cardId]);
    run('UPDATE map_pins SET card_id = NULL WHERE card_id = ?', [cardId]);
    run('UPDATE outline_nodes SET card_id = NULL WHERE card_id = ?', [cardId]);
    run('DELETE FROM cards WHERE id = ?', [cardId]);
  });
}

/** 删除一张地图并清理标记与区域 */
export function purgeMap(mapId: string): void {
  tx(() => {
    run('DELETE FROM map_pins WHERE map_id = ?', [mapId]);
    run('DELETE FROM map_regions WHERE map_id = ?', [mapId]);
    run('UPDATE timeline_entries SET map_id = NULL WHERE map_id = ?', [mapId]);
    run('DELETE FROM maps WHERE id = ?', [mapId]);
  });
}

/** 按分支删除数据（删除平行世界分支时使用；主世界数据保留） */
export function purgeBranch(branchId: string): void {
  tx(() => {
    run('DELETE FROM card_tags WHERE card_id IN (SELECT id FROM cards WHERE branch_id = ?)', [branchId]);
    run('DELETE FROM card_assets WHERE card_id IN (SELECT id FROM cards WHERE branch_id = ?)', [branchId]);
    run('DELETE FROM relations WHERE branch_id = ?', [branchId]);
    run('DELETE FROM cards WHERE branch_id = ?', [branchId]);
    run('DELETE FROM map_pins WHERE map_id IN (SELECT id FROM maps WHERE branch_id = ?)', [branchId]);
    run('DELETE FROM map_regions WHERE map_id IN (SELECT id FROM maps WHERE branch_id = ?)', [branchId]);
    run('DELETE FROM maps WHERE branch_id = ?', [branchId]);
    run('DELETE FROM timeline_entries WHERE branch_id = ?', [branchId]);
    run('DELETE FROM tracks WHERE branch_id = ?', [branchId]);
    run('DELETE FROM docs WHERE branch_id = ?', [branchId]);
    run('DELETE FROM branches WHERE id = ?', [branchId]);
  });
}
