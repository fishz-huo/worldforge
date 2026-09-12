/**
 * 首次启动的示例世界观
 * ------------------------------------------------------------------
 * 目的：让用户打开软件就能看到「卡片 / 地图 / 时间轴 / 大纲 / 正文」
 * 全链路的样子，而不是面对一个空壳。所有内容都可以一键删除或重建。
 *
 * 数据分两层：
 *   - cards.ts 设定层（卡片 / 标签 / 关联）
 *   - world.ts 场景层（地图 / 时间轴 / 文稿 / 大纲），引用设定层的卡片
 */
import type { Branch, Card, Doc, Era, MapDef, MapPin, MapRegion, OutlineNode, Relation, Tag, TimelineEntry, Track, World } from '@/types';
import { DEFAULT_TIME_CONFIG } from '@/types';
import { newBranchId, newWorldId } from '@/lib/id';
import { buildSeedCards } from './cards';
import { buildSeedScene } from './world';

/** 示例数据的完整集合 */
export interface SeedBundle {
  world: World;
  branch: Branch;
  cards: Card[];
  tags: Tag[];
  cardTags: { card_id: string; tag_id: string }[];
  relations: Relation[];
  maps: MapDef[];
  pins: MapPin[];
  regions: MapRegion[];
  tracks: Track[];
  entries: TimelineEntry[];
  eras: Era[];
  docs: Doc[];
  outlineNodes: OutlineNode[];
}

export { buildSeedCards } from './cards';
export { buildSeedScene } from './world';

/** 生成一整套示例数据（每次调用都产生新的 id） */
export function buildSeed(): SeedBundle {
  const now = Date.now();
  const worldId = newWorldId();
  const stamp = { created_at: now, updated_at: now };

  const world: World = {
    id: worldId,
    ...stamp,
    name: '示例世界 · 灰烬纪元',
    description: '一块被「灵息」浸透的大陆。灵息既是能源，也是枷锁——它让少数人超凡，也让多数人窒息。',
    meta: {
      time: { ...DEFAULT_TIME_CONFIG, unit: '年', zeroLabel: '焚天历元年', defaultStart: 0, defaultEnd: 600 },
    },
  };

  const branch: Branch = {
    id: newBranchId(),
    ...stamp,
    world_id: worldId,
    name: 'if 线 · 灰烬未落',
    description: '假设主角在「烬关之战」中拒绝点燃灵脉，大陆格局随之改写。',
    color: '#0ea5e9',
    divergence: '第 245 年，烬关之战中主角拒绝点燃灵息灵脉',
    divergence_t: 245,
    forked_from: null,
  };

  const cards = buildSeedCards(worldId, now);
  const scene = buildSeedScene(worldId, now, cards);

  return {
    world,
    branch,
    cards: cards.cards,
    tags: cards.tags,
    cardTags: cards.cardTags,
    relations: cards.relations,
    ...scene,
  };
}
