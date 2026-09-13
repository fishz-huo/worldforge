/**
 * 导入时的 id 重映射
 * ------------------------------------------------------------------
 * 为什么必须重映射（这是一个真实的数据丢失缺陷）：
 * 各表的 id 是**全局主键**。导入别人的备份时，如果直接沿用文件里的 id，
 * 两条「同一份备份」的记录会撞在同一个主键上，UPSERT 会把原来那一行
 * 的 world_id 改成新世界观 —— 表现就是：
 *   「导出 A 世界观的备份 → 导入到 B 世界观 → A 的数据跑到 B 去了，A 变空」。
 *
 * 所以导入必须像「派生分支」那样，把每个实体换成新 id，
 * 并且同步改写所有跨表引用（关联两端、标签挂载、标记点绑定的卡片、
 * 时间轴条目、大纲节点与父子关系、文稿关联、分支溯源）。
 *
 * 特别保留的两类 id：
 *   - assets（图片）：二进制在 IndexedDB 里以 id 为键，沿用原 id 才不会丢图，
 *     重复导入也只是覆盖同一张图，不会无限膨胀；
 *   - card_assets：没有 id 列（card_id + asset_id 复合主键），所以两边都要重映射。
 */
import type { SnapshotPayload } from '@/types';
import { newBranchId, newCardId, newDocId, newEntryId, newEraId, newMapId, newOutlineId, newPinId, newRegionId, newTagId, newTrackId } from './id';

/** 一行记录（导入数据来自磁盘，字段形状不可信，因此按普通对象处理） */
type Row = Record<string, unknown>;

/** 逐项生成「旧 id → 新 id」的映射表 */
function idMap(list: unknown[], next: () => string): Map<string, string> {
  const map = new Map<string, string>();
  list.forEach((row) => {
    const id = (row as Row | null)?.id;
    if (typeof id === 'string') map.set(id, next());
  });
  return map;
}

/** 把某一列按映射表改写（映射里没有的值原样保留） */
function remapColumn(list: unknown[], column: string, map: Map<string, string>): void {
  list.forEach((row) => {
    const target = row as Row;
    const value = target[column];
    if (typeof value === 'string' && map.has(value)) target[column] = map.get(value);
  });
}

/** 深拷贝快照，避免改到调用方手上的数据 */
function clone(payload: SnapshotPayload): SnapshotPayload {
  return JSON.parse(JSON.stringify(payload)) as SnapshotPayload;
}

/**
 * 生成一份「全新 id」的快照，跨表引用同步改写。
 * 返回 remap 后的 payload，调用方再把它写成目标世界观的数据。
 */
export function remapSnapshotIds(payload: SnapshotPayload): SnapshotPayload {
  const snap = clone(payload);

  const branches = idMap(snap.branches, newBranchId);
  const cards = idMap(snap.cards, newCardId);
  const tags = idMap(snap.tags, newTagId);
  const maps = idMap(snap.maps, newMapId);
  const pins = idMap(snap.pins, newPinId);
  const regions = idMap(snap.regions, newRegionId);
  const tracks = idMap(snap.tracks, newTrackId);
  const entries = idMap(snap.entries, newEntryId);
  const eras = idMap(snap.eras, newEraId);
  const docs = idMap(snap.docs, newDocId);
  const nodes = idMap(snap.outlineNodes, newOutlineId);

  const applyId = (list: unknown[], map: Map<string, string>) => {
    list.forEach((row) => {
      const target = row as Row;
      const id = target.id;
      if (typeof id === 'string' && map.has(id)) target.id = map.get(id);
    });
  };
  applyId(snap.branches, branches);
  applyId(snap.cards, cards);
  applyId(snap.tags, tags);
  applyId(snap.maps, maps);
  applyId(snap.pins, pins);
  applyId(snap.regions, regions);
  applyId(snap.tracks, tracks);
  applyId(snap.entries, entries);
  applyId(snap.eras, eras);
  applyId(snap.docs, docs);
  applyId(snap.outlineNodes, nodes);

  // 卡片：所属分支
  remapColumn(snap.cards, 'branch_id', branches);
  // 标签挂载：卡片与标签
  remapColumn(snap.cardTags, 'card_id', cards);
  remapColumn(snap.cardTags, 'tag_id', tags);
  // 关联：两端与分支
  remapColumn(snap.relations, 'from_id', cards);
  remapColumn(snap.relations, 'to_id', cards);
  remapColumn(snap.relations, 'branch_id', branches);
  // 地图与地图元素：地图归属、标记点绑定的卡片
  remapColumn(snap.maps, 'branch_id', branches);
  remapColumn(snap.pins, 'map_id', maps);
  remapColumn(snap.pins, 'card_id', cards);
  remapColumn(snap.regions, 'map_id', maps);
  // 时间轴：泳道、条目（含绑定的卡片与地图）
  remapColumn(snap.tracks, 'branch_id', branches);
  remapColumn(snap.entries, 'track_id', tracks);
  remapColumn(snap.entries, 'card_id', cards);
  remapColumn(snap.entries, 'map_id', maps);
  remapColumn(snap.entries, 'branch_id', branches);
  // 文稿与大纲：文稿归属、大纲父子与关联
  remapColumn(snap.docs, 'branch_id', branches);
  remapColumn(snap.docs, 'card_id', cards);
  remapColumn(snap.outlineNodes, 'doc_id', docs);
  remapColumn(snap.outlineNodes, 'parent_id', nodes);
  remapColumn(snap.outlineNodes, 'card_id', cards);
  remapColumn(snap.outlineNodes, 'link_doc_id', docs);
  // 分支溯源
  remapColumn(snap.branches, 'forked_from', branches);

  return snap;
}
