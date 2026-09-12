/**
 * 示例世界观 · 场景层数据
 * ------------------------------------------------------------------
 * 地图（含标记与资源区域）、时间轴（泳道 / 条目 / 纪元）、
 * 文稿与大纲树。全部引用 cards.ts 里的卡片，保持数据自洽。
 */
import type { Doc, Era, MapDef, MapPin, MapRegion, OutlineNode, TimelineEntry, Track } from '@/types';
import { newDocId, newEntryId, newEraId, newMapId, newOutlineId, newPinId, newRegionId, newTrackId } from '@/lib/id';
import type { SeedCards } from './cards';

/** 场景层数据包 */
export interface SeedScene {
  maps: MapDef[];
  pins: MapPin[];
  regions: MapRegion[];
  tracks: Track[];
  entries: TimelineEntry[];
  eras: Era[];
  docs: Doc[];
  outlineNodes: OutlineNode[];
}

/** 构建示例场景数据 */
export function buildSeedScene(worldId: string, now: number, seed: SeedCards): SeedScene {
  const { byKey } = seed;
  const maps: MapDef[] = [];
  const pins: MapPin[] = [];
  const regions: MapRegion[] = [];
  const tracks: Track[] = [];
  const entries: TimelineEntry[] = [];
  const eras: Era[] = [];
  const docs: Doc[] = [];
  const outlineNodes: OutlineNode[] = [];

  /* ------------------------------ 地图 ------------------------------ */
  const mapId = newMapId();
  maps.push({
    id: mapId, world_id: worldId, branch_id: null, name: '大陆全图 · 焚天历 245 年',
    description: '灰烬王国与北境联盟对峙时期的疆域与资源分布。',
    asset_id: null, period: '焚天历 245 年', period_t: 245, opacity: 0.9, meta: {},
    created_at: now, updated_at: now,
  });

  const pin = (cardId: string | null, x: number, y: number, label: string, icon: string, color: string, note = '') => {
    pins.push({ id: newPinId(), map_id: mapId, card_id: cardId, x, y, label, icon, color, note });
  };
  pin(byKey.capital.id, 0.52, 0.58, '焚天城', '🏛', '#ef4444', '灵脉节点');
  pin(byKey.mineTown.id, 0.24, 0.33, '灰港矿镇', '⛏', '#94a3b8');
  pin(byKey.warEvent.id, 0.74, 0.42, '烬关', '⚔', '#f59e0b', '地理变化：关隘以西已灰化');
  pin(null, 0.4, 0.78, '南岭灵脉', '💠', '#0ea5e9', '未开发灵脉');

  regions.push(
    {
      id: newRegionId(), map_id: mapId, name: '灰烬王国', color: '#ef4444',
      points: [[0.3, 0.4], [0.65, 0.35], [0.78, 0.55], [0.6, 0.78], [0.32, 0.7]],
      resources: { population: 420, agriculture: 30, mineral: 90, military: 75, trade: 55 },
      period: '焚天历 245 年', note: '以焚天城为绝对中心',
    },
    {
      id: newRegionId(), map_id: mapId, name: '北境联盟', color: '#0ea5e9',
      points: [[0.1, 0.05], [0.5, 0.02], [0.55, 0.25], [0.2, 0.3]],
      resources: { population: 180, agriculture: 45, mineral: 60, military: 65, trade: 40 },
      period: '焚天历 245 年', note: '灵息稀薄，反而较早发展灵械',
    },
  );

  /* ------------------------------ 时间轴 ------------------------------ */
  const track = (name: string, kind: Track['kind'], color: string, valued = false): Track => {
    const item: Track = {
      id: newTrackId(), world_id: worldId, branch_id: null, name, kind, color,
      order_index: tracks.length, hidden: 0, valued: valued ? 1 : 0,
    };
    tracks.push(item);
    return item;
  };
  const tEvent = track('大陆大事', 'event', '#f59e0b');
  const tHero = track('烬·阿舒尔', 'character', '#8b5cf6');
  const tMentor = track('薇拉·索恩', 'character', '#ec4899');
  const tGeo = track('地理变化', 'geo', '#0ea5e9');
  const tTech = track('灵息浓度', 'tech', '#22c55e', true);

  const entry = (
    t: Track, start: number, end: number | null, title: string,
    cardId: string | null, note = '', state = '', value: number | null = null,
  ) => {
    entries.push({
      id: newEntryId(), world_id: worldId, branch_id: null, track_id: t.id, card_id: cardId,
      title, start_t: start, end_t: end, instant: end === null ? 1 : 0,
      note, state, value, map_id: null, created_at: now,
    });
  };

  entry(tEvent, 0, 12, '焚天陨落', byKey.lore.id, '星体坠落，灵息渗入地脉', '灵息纪元开启');
  entry(tEvent, 180, 232, '灵息战争', null, '围绕灵脉的百年混战', '三国并立');
  entry(tEvent, 245, 245.3, '烬关之战', byKey.warEvent.id, '点燃灵脉的战术胜利', '灰烬王国崛起');
  entry(tHero, 221, null, '出生', byKey.protagonist.id, '灰港矿镇', '矿工之子');
  entry(tHero, 235, null, '矿难', byKey.protagonist.id, '全家罹难，唯他被灵息选中', '幸存者 / 燃血者');
  entry(tHero, 240, 245, '骑士团末席', byKey.protagonist.id, '被薇拉收编', '人形息匣（受控）');
  entry(tHero, 245.3, null, '成为各国争夺目标', byKey.protagonist.id, '烬关之战后身份公开', '逃亡中的兵器');
  entry(tMentor, 178, null, '出生', byKey.mentor.id, '', '北境流亡贵族之女');
  entry(tMentor, 230, null, '接任团长', byKey.mentor.id, '以灵械战术重整骑士团', '灰烬骑士团团长');
  entry(tGeo, 245.3, null, '烬关以西灰化', byKey.warEvent.id, '约 300 平方公里土地变成灰原', '不可耕种，灵息外溢');
  entry(tTech, 0, 100, '灵息浓度 100%', null, '地脉充盈', '超凡者稀缺但强大', 100);
  entry(tTech, 300, null, '灵息浓度 70%', null, '预测值：枯竭倒计时', '', 70);

  const era = (name: string, start: number, end: number, color: string, note: string) => {
    eras.push({ id: newEraId(), world_id: worldId, name, start_t: start, end_t: end, color, note });
  };
  era('余烬时代', 0, 120, '#334155', '焚天陨落后的混乱期');
  era('灵息战争', 180, 232, '#7f1d1d', '百年灵脉争夺');
  era('灰烬纪元', 232, 330, '#78350f', '王国并立与灵械崛起');

  /* ------------------------------ 文稿与大纲 ------------------------------ */
  const manuscript: Doc = {
    id: newDocId(), world_id: worldId, branch_id: null, kind: 'manuscript',
    title: '第一章 · 竖井之下',
    summary: '阿舒尔在矿难中第一次听见灵息的低语。',
    order_index: 0, card_id: null, created_at: now, updated_at: now,
    content: [
      '# 第一章 · 竖井之下',
      '',
      '井底的空气有铁锈味。阿舒尔数着提升机的钢缆声，第十七下时，声音停了。',
      '',
      '他后来才知道，那一下停顿，是[[灵息]]第一次向他开口。',
      '',
      '> 「你听得见。」',
      '',
      '## 一',
      '',
      '- 矿镇 [[灰港矿镇]] 的清晨',
      '- 父亲留下的旧息匣',
      '- 薇拉·索恩出现在井口',
      '',
      '他抬头，看见 [[焚天城]] 方向的灰霾里透出一道极细的红光。',
      '',
      '参考：[[《能源与文明：化石燃料简史》]] 中关于能源垄断的描述。',
    ].join('\n'),
  };

  const outline: Doc = {
    id: newDocId(), world_id: worldId, branch_id: null, kind: 'outline',
    title: '主线大纲', summary: '三幕结构总览', order_index: 1, card_id: null,
    created_at: now, updated_at: now,
    content: '# 主线大纲\n\n## 第一幕 · 被使用\n- 矿难与觉醒\n- 被收编进灰烬骑士团\n\n## 第二幕 · 学会使用\n- 烬关之战\n- 身份暴露\n\n## 第三幕 · 拒绝使用\n- 反叛薇拉\n- 关闭灵脉',
  };
  docs.push(manuscript, outline);

  const node = (
    parent: string | null, order: number, title: string,
    status: OutlineNode['status'], summary: string, cardId: string | null = null,
  ): OutlineNode => {
    const item: OutlineNode = {
      id: newOutlineId(), doc_id: outline.id, parent_id: parent, order_index: order,
      title, summary, status, card_id: cardId, link_doc_id: null, meta: {},
    };
    outlineNodes.push(item);
    return item;
  };
  const act1 = node(null, 0, '第一幕 · 被使用', 'done', '建立「人是工具」的世界规则');
  const act2 = node(null, 1, '第二幕 · 学会使用', 'draft', '主角开始反过来使用体系');
  const act3 = node(null, 2, '第三幕 · 拒绝使用', 'idea', '代价与选择的兑现');
  node(act1.id, 0, '矿难与觉醒', 'done', '竖井之下第一次听见灵息', byKey.mineTown.id);
  node(act1.id, 1, '被收编', 'done', '薇拉把他带走，成为末席', byKey.mentor.id);
  node(act2.id, 0, '烬关之战', 'draft', '被强制点燃灵脉', byKey.warEvent.id);
  node(act2.id, 1, '身份暴露', 'draft', '各国开始争夺人形息匣', byKey.protagonist.id);
  node(act3.id, 0, '反叛', 'idea', '与薇拉的正面冲突');
  node(act3.id, 1, '关闭灵脉', 'idea', '以自身灰化为代价终结体系', byKey.lore.id);

  return { maps, pins, regions, tracks, entries, eras, docs, outlineNodes };
}
