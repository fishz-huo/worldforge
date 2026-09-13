/**
 * 导入辅助：世界观归属改写、世界观元信息读取、行数统计
 * ------------------------------------------------------------------
 * 这三件事都围绕「导入之后，数据到底是不是真的落到了目标世界观」，
 * 与 id 重映射（backup-remap.ts）、格式预检（backup-inspect.ts）分开，
 * 让 backup.ts 只保留「导出 / 导入」两个动作本身。
 *
 * 类型说明：SnapshotPayload 的数组元素是 unknown（快照来自磁盘，形状不可信），
 * 所以这里只做形状判断，不做字段级校验 —— 字段级正确性由写库事务保证。
 */
import type { SnapshotPayload } from '@/types';
import { one } from './db/sqlite';

/**
 * 「快照字段名 → 数据库表名」对照。
 * 导入后按这张表统计行数：写完必须一张不少，否则整笔回滚。
 * 两者并不总是同名（快照里叫 entries，表名是 timeline_entries），
 * 所以不能拿字段名当表名拼 SQL。
 * 注意 card_assets 没有 world_id 列（靠 card_id 归属），要单独统计。
 */
export const WORLD_TABLES: { key: keyof SnapshotPayload & string; table: string; viaCards?: boolean }[] = [
  { key: 'branches', table: 'branches' },
  { key: 'cards', table: 'cards' },
  { key: 'tags', table: 'tags' },
  { key: 'cardAssets', table: 'card_assets', viaCards: true },
  { key: 'relations', table: 'relations' },
  { key: 'maps', table: 'maps' },
  { key: 'tracks', table: 'tracks' },
  { key: 'entries', table: 'timeline_entries' },
  { key: 'eras', table: 'eras' },
  { key: 'docs', table: 'docs' },
];

/**
 * 把快照里的 world_id 全部改写成目标世界观。
 * 为什么需要：导出是按「当前世界观」做的，文件里带着来源世界的 id。
 * 如果直接写回，导入到别的世界观（例如新建一个空世界观再导入）时，
 * 所有行的 world_id 仍是来源世界的，reload 按当前世界筛选就一条都看不见 ——
 * 而导入前的确认框已经把当前世界观清空了，表现为「导入成功但数据全没了」。
 */
export function rebindWorld(payload: SnapshotPayload, worldId: string): SnapshotPayload {
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

/** 从快照里安全读出世界观那一行的名字 / 简介 / meta（形状不对时返回 null） */
export function readWorldMeta(payload: SnapshotPayload): { name: string; description: string; meta: unknown } | null {
  const world = payload.world;
  if (!world || typeof world !== 'object') return null;
  const row = world as Record<string, unknown>;
  return {
    name: typeof row.name === 'string' ? row.name : '',
    description: typeof row.description === 'string' ? row.description : '',
    meta: row.meta ?? {},
  };
}

/** 统计某个世界观现在有多少行（导入后查一次，用来判断到底写进去没有） */
export function countWorldRows(worldId: string): number {
  return WORLD_TABLES.reduce((sum, { table, viaCards }) => {
    const where = viaCards
      ? 'card_id IN (SELECT id FROM cards WHERE world_id = ?)'
      : 'world_id = ?';
    return sum + (one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, [worldId])?.n ?? 0);
  }, 0);
}

/** 备份里这些表的行数总和 */
export function countBackupRows(payload: SnapshotPayload): number {
  return WORLD_TABLES.reduce((sum, { key }) => sum + ((payload[key] as unknown[] | undefined)?.length ?? 0), 0);
}
