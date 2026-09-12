/**
 * 内置卡片类型字典
 * ------------------------------------------------------------------
 * 九种内置类型覆盖需求 1/4/9：角色、地点、事件、底层逻辑、势力、物品、
 * 概念、参考资料、随笔。插件注册的新类型会在 lib/registry.ts 里合并进来。
 */
import type { CardTypeDef } from './field';
import {
  LOCATION_CATEGORIES,
  LORE_CATEGORIES,
  REFERENCE_SOURCES,
} from './field';

/** 角色 */
const character: CardTypeDef = {
  type: 'character',
  label: '角色',
  icon: 'User',
  color: '#8b5cf6',
  titlePlaceholder: '角色姓名',
  summaryLabel: '一句话简介',
  timeline: true,
  fields: [
    { key: 'birth_t', label: '出生刻度', kind: 'time', group: '生平', hint: '时间轴刻度；用于推算任意时间点的年龄' },
    { key: 'death_t', label: '死亡刻度', kind: 'time', group: '生平', hint: '留空表示在世' },
    { key: 'gender', label: '性别', kind: 'text', group: '生平' },
    { key: 'race', label: '种族', kind: 'text', group: '生平', searchable: true },
    { key: 'affiliation', label: '所属势力', kind: 'text', group: '生平', searchable: true },
    { key: 'identity', label: '身份 / 职业', kind: 'text', group: '生平', searchable: true },
    { key: 'appearance', label: '外貌', kind: 'textarea', group: '形象' },
    { key: 'personality', label: '性格', kind: 'textarea', group: '形象' },
    { key: 'goal', label: '目标 / 动机', kind: 'textarea', group: '内核' },
    { key: 'ability', label: '能力 / 特长', kind: 'textarea', group: '内核' },
    { key: 'weakness', label: '弱点 / 缺陷', kind: 'textarea', group: '内核' },
  ],
};

/** 地点 */
const location: CardTypeDef = {
  type: 'location',
  label: '地点',
  icon: 'MapPin',
  color: '#0ea5e9',
  titlePlaceholder: '地点名称',
  summaryLabel: '一句话简介',
  fields: [
    { key: 'category', label: '类型', kind: 'select', options: LOCATION_CATEGORIES, group: '地理' },
    { key: 'terrain', label: '地形', kind: 'text', group: '地理', searchable: true },
    { key: 'climate', label: '气候', kind: 'text', group: '地理' },
    { key: 'population', label: '人口', kind: 'number', group: '资源', hint: '可与地图区域资源联动统计' },
    { key: 'agriculture', label: '农业（0-100）', kind: 'number', group: '资源' },
    { key: 'mineral', label: '矿产（0-100）', kind: 'number', group: '资源' },
    { key: 'resource_note', label: '其它资源', kind: 'textarea', group: '资源' },
    { key: 'faction', label: '控制势力', kind: 'text', group: '政区', searchable: true },
    { key: 'landmark', label: '地标', kind: 'text', group: '政区' },
  ],
};

/** 事件 */
const event: CardTypeDef = {
  type: 'event',
  label: '事件',
  icon: 'Zap',
  color: '#f59e0b',
  titlePlaceholder: '事件名称',
  summaryLabel: '一句话概述',
  timeline: true,
  fields: [
    { key: 'start_t', label: '开始刻度', kind: 'time', group: '时间' },
    { key: 'end_t', label: '结束刻度', kind: 'time', group: '时间', hint: '留空表示瞬时事件' },
    { key: 'scale', label: '影响范围', kind: 'select', group: '时间', options: [
      { value: 'personal', label: '个人' },
      { value: 'regional', label: '区域' },
      { value: 'national', label: '国家' },
      { value: 'world', label: '世界级' },
    ] },
    { key: 'cause', label: '起因', kind: 'textarea', group: '因果' },
    { key: 'process', label: '经过', kind: 'textarea', group: '因果' },
    { key: 'outcome', label: '结果 / 影响', kind: 'textarea', group: '因果' },
  ],
};

/** 底层逻辑 */
const lore: CardTypeDef = {
  type: 'lore',
  label: '底层逻辑',
  icon: 'Atom',
  color: '#10b981',
  titlePlaceholder: '体系名称，如「灵息」',
  summaryLabel: '一句话定义',
  fields: [
    { key: 'category', label: '类别', kind: 'select', options: LORE_CATEGORIES, group: '体系' },
    { key: 'scope', label: '作用范围', kind: 'text', group: '体系', hint: '全局 / 局部区域 / 特定种族' },
    { key: 'source', label: '来源', kind: 'text', group: '体系' },
    { key: 'rule', label: '核心规则', kind: 'textarea', group: '规则' },
    { key: 'cost', label: '代价 / 限制', kind: 'textarea', group: '规则' },
    { key: 'impact', label: '对世界的影响', kind: 'textarea', group: '影响' },
    { key: 'evolution', label: '演变趋势', kind: 'textarea', group: '影响' },
  ],
};

/** 势力 */
const faction: CardTypeDef = {
  type: 'faction',
  label: '势力',
  icon: 'Flag',
  color: '#ef4444',
  titlePlaceholder: '势力名称',
  summaryLabel: '一句话简介',
  timeline: true,
  fields: [
    { key: 'leader', label: '领袖', kind: 'text', group: '组织', searchable: true },
    { key: 'scale', label: '规模', kind: 'text', group: '组织' },
    { key: 'ideology', label: '理念 / 目标', kind: 'textarea', group: '组织' },
    { key: 'territory', label: '势力范围', kind: 'text', group: '组织' },
    { key: 'founded_t', label: '成立刻度', kind: 'time', group: '时间' },
    { key: 'dissolved_t', label: '解散刻度', kind: 'time', group: '时间' },
  ],
};

/** 物品 / 设定物 */
const item: CardTypeDef = {
  type: 'item',
  label: '物品',
  icon: 'Gem',
  color: '#a855f7',
  titlePlaceholder: '物品名称',
  summaryLabel: '一句话简介',
  fields: [
    { key: 'rarity', label: '稀有度', kind: 'text', group: '属性' },
    { key: 'origin', label: '来源', kind: 'text', group: '属性' },
    { key: 'effect', label: '效果', kind: 'textarea', group: '属性' },
    { key: 'owner', label: '持有者', kind: 'text', group: '归属', searchable: true },
  ],
};

/** 概念 / 名词 */
const concept: CardTypeDef = {
  type: 'concept',
  label: '概念',
  icon: 'BookOpen',
  color: '#14b8a6',
  titlePlaceholder: '概念名称',
  summaryLabel: '一句话定义',
  fields: [
    { key: 'domain', label: '领域', kind: 'text', group: '定义' },
    { key: 'alias', label: '别名', kind: 'text', group: '定义' },
    { key: 'detail', label: '详细解释', kind: 'textarea', group: '定义' },
  ],
};

/** 参考资料 */
const reference: CardTypeDef = {
  type: 'reference',
  label: '参考资料',
  icon: 'Library',
  color: '#64748b',
  titlePlaceholder: '资料标题',
  summaryLabel: '摘要',
  fields: [
    { key: 'source_type', label: '资料类型', kind: 'select', options: REFERENCE_SOURCES, group: '出处' },
    { key: 'author', label: '作者', kind: 'text', group: '出处', searchable: true },
    { key: 'url', label: '链接', kind: 'text', group: '出处' },
    { key: 'year', label: '年份', kind: 'text', group: '出处' },
    { key: 'quote', label: '关键摘录', kind: 'textarea', group: '内容' },
    { key: 'takeaway', label: '可借鉴点', kind: 'textarea', group: '内容' },
  ],
};

/** 随笔 / 杂项 */
const note: CardTypeDef = {
  type: 'note',
  label: '随笔',
  icon: 'StickyNote',
  color: '#eab308',
  titlePlaceholder: '标题',
  summaryLabel: '一句话摘要',
  fields: [],
};

/** 全部内置类型，顺序即侧边栏展示顺序 */
export const BUILTIN_CARD_TYPES: CardTypeDef[] = [
  character,
  location,
  event,
  lore,
  faction,
  item,
  concept,
  reference,
  note,
];

/** 内置类型快速索引 */
export const BUILTIN_CARD_TYPE_MAP: Record<string, CardTypeDef> = Object.fromEntries(
  BUILTIN_CARD_TYPES.map((t) => [t.type, t]),
);
