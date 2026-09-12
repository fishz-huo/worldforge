/**
 * 全部表的描述与仓储实例
 * ------------------------------------------------------------------
 * 业务层只从这里取仓储，例如 `cardsRepo.list('world_id = ?', [wid])`。
 * 新增字段时：改 schema.ts 的 DDL + 这里对应的列清单即可。
 */
import type {
  Asset,
  Branch,
  Card,
  CardAsset,
  Doc,
  Era,
  MapDef,
  MapPin,
  MapRegion,
  OutlineNode,
  PluginRecord,
  Relation,
  Tag,
  TimelineEntry,
  Track,
  Version,
  World,
} from '@/types';
import { createRepo, defineTable } from './table';
import { all, run, tx } from './sqlite';

/* ------------------------------ 表描述 ------------------------------ */

export const WORLD_SPEC = defineTable('worlds',
  ['name', 'description', 'meta', 'created_at', 'updated_at'], { meta: {} });

export const BRANCH_SPEC = defineTable('branches',
  ['world_id', 'name', 'description', 'color', 'divergence', 'divergence_t', 'forked_from', 'created_at', 'updated_at']);

export const CARD_SPEC = defineTable('cards',
  ['world_id', 'branch_id', 'type', 'title', 'subtitle', 'summary', 'body', 'fields',
    'cover_asset', 'pinned', 'created_at', 'updated_at'], { fields: {} });

export const CARD_ASSET_SPEC = defineTable('card_assets',
  ['card_id', 'asset_id', 'caption', 'order_index']);

export const TAG_SPEC = defineTable('tags', ['world_id', 'name', 'color', 'created_at']);

export const RELATION_SPEC = defineTable('relations',
  ['world_id', 'branch_id', 'from_id', 'to_id', 'label', 'note', 'directed', 'start_t', 'end_t', 'created_at']);

export const MAP_SPEC = defineTable('maps',
  ['world_id', 'branch_id', 'name', 'description', 'asset_id', 'period', 'period_t',
    'opacity', 'meta', 'created_at', 'updated_at'], { meta: {} });

export const PIN_SPEC = defineTable('map_pins',
  ['map_id', 'card_id', 'x', 'y', 'label', 'icon', 'color', 'note']);

export const REGION_SPEC = defineTable('map_regions',
  ['map_id', 'name', 'color', 'points', 'resources', 'period', 'note'], { points: [], resources: {} });

export const TRACK_SPEC = defineTable('tracks',
  ['world_id', 'branch_id', 'name', 'kind', 'color', 'order_index', 'hidden', 'valued']);

export const ENTRY_SPEC = defineTable('timeline_entries',
  ['world_id', 'branch_id', 'track_id', 'card_id', 'title', 'start_t', 'end_t', 'instant',
    'note', 'state', 'value', 'map_id', 'created_at']);

export const ERA_SPEC = defineTable('eras', ['world_id', 'name', 'start_t', 'end_t', 'color', 'note']);

export const DOC_SPEC = defineTable('docs',
  ['world_id', 'branch_id', 'kind', 'title', 'content', 'summary', 'order_index', 'card_id',
    'created_at', 'updated_at']);

export const OUTLINE_SPEC = defineTable('outline_nodes',
  ['doc_id', 'parent_id', 'order_index', 'title', 'summary', 'status', 'card_id', 'link_doc_id', 'meta'],
  { meta: {} });

export const VERSION_SPEC = defineTable('versions',
  ['world_id', 'name', 'note', 'snapshot', 'size', 'created_at']);

export const ASSET_SPEC = defineTable('assets',
  ['world_id', 'name', 'mime', 'size', 'width', 'height', 'kind', 'created_at']);

export const PLUGIN_SPEC = defineTable('plugins',
  ['name', 'version', 'author', 'description', 'code', 'enabled', 'builtin',
    'settings_schema', 'settings', 'created_at'], { settings_schema: {}, settings: {} });

/* ------------------------------ 仓储实例 ------------------------------ */

export const worldsRepo = createRepo<World>(WORLD_SPEC);
export const branchesRepo = createRepo<Branch>(BRANCH_SPEC);
export const cardsRepo = createRepo<Card>(CARD_SPEC);
export const cardAssetsRepo = createRepo<CardAsset>(CARD_ASSET_SPEC);
export const tagsRepo = createRepo<Tag>(TAG_SPEC);
export const relationsRepo = createRepo<Relation>(RELATION_SPEC);
export const mapsRepo = createRepo<MapDef>(MAP_SPEC);
export const pinsRepo = createRepo<MapPin>(PIN_SPEC);
export const regionsRepo = createRepo<MapRegion>(REGION_SPEC);
export const tracksRepo = createRepo<Track>(TRACK_SPEC);
export const entriesRepo = createRepo<TimelineEntry>(ENTRY_SPEC);
export const erasRepo = createRepo<Era>(ERA_SPEC);
export const docsRepo = createRepo<Doc>(DOC_SPEC);
export const outlineRepo = createRepo<OutlineNode>(OUTLINE_SPEC);
export const versionsRepo = createRepo<Version>(VERSION_SPEC);
export const assetsRepo = createRepo<Asset>(ASSET_SPEC);
export const pluginsRepo = createRepo<PluginRecord>(PLUGIN_SPEC);

/* --------------------- 卡片 ↔ 标签（复合主键，单独处理） --------------------- */

/** 查询某世界观下的全部卡片-标签关系 */
export function listCardTags(cardIds: string[]): { card_id: string; tag_id: string }[] {
  if (cardIds.length === 0) return [];
  const placeholders = cardIds.map(() => '?').join(', ');
  return all<{ card_id: string; tag_id: string }>(
    `SELECT card_id, tag_id FROM card_tags WHERE card_id IN (${placeholders})`,
    cardIds,
  );
}

/** 覆盖式设置某张卡片的标签 */
export function setCardTags(cardId: string, tagIds: string[]): void {
  tx(() => {
    run('DELETE FROM card_tags WHERE card_id = ?', [cardId]);
    tagIds.forEach((tagId) => {
      run('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)', [cardId, tagId]);
    });
  });
}

/** 删除某张卡片的全部标签关系 */
export function clearCardTags(cardId: string): void {
  run('DELETE FROM card_tags WHERE card_id = ?', [cardId]);
}

/** 列出某个世界观下所有已使用的标签关系（用于批量构建索引） */
export function listAllCardTags(worldId: string): { card_id: string; tag_id: string }[] {
  return all<{ card_id: string; tag_id: string }>(
    `SELECT ct.card_id AS card_id, ct.tag_id AS tag_id FROM card_tags ct
     JOIN cards c ON c.id = ct.card_id WHERE c.world_id = ?`,
    [worldId],
  );
}
