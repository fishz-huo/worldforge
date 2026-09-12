/**
 * 标签（Tag）与关联（Relation）
 * ------------------------------------------------------------------
 * 需求 11：tag 内容自由填写，并支持按 tag 筛选卡片。
 * 需求 1 ：卡片之间可自由关联，关系名称由用户自己写（师徒 / 隶属 / 导致…）。
 */
import type { Id } from './common';

/** 标签 */
export interface Tag {
  id: Id;
  world_id: Id;
  name: string;
  color: string;
  created_at: number;
}

/** 卡片 ↔ 标签 多对多 */
export interface CardTag {
  card_id: Id;
  tag_id: Id;
}

/** 关联关系：from --label--> to */
export interface Relation {
  id: Id;
  world_id: Id;
  branch_id: Id | null;
  /** 起点卡片 */
  from_id: Id;
  /** 终点卡片 */
  to_id: Id;
  /** 关系名称，完全自由填写，如「师父」「效忠于」「导致了」 */
  label: string;
  /** 补充说明 */
  note: string;
  /** 1 = 有向（默认），0 = 无向（互为同级关系） */
  directed: number;
  /** 关系的生效 / 结束刻度，可用于时间轴上的关系变化（可空） */
  start_t: number | null;
  end_t: number | null;
  created_at: number;
}

/** 关联在 UI 上的一种呈现方向 */
export interface RelationEdge extends Relation {
  /** outgoing = 当前卡片指向别人；incoming = 别人指向当前卡片 */
  direction: 'outgoing' | 'incoming';
}

/** 常用关系名建议（仅作输入提示，不限制用户自由填写） */
export const RELATION_SUGGESTIONS = [
  '师父', '徒弟', '亲属', '挚友', '宿敌', '效忠于', '隶属于', '统治',
  '出生于', '居住于', '参与', '导致', '引发', '参考自', '灵感来自',
  '拥有', '制造', '守护', '信仰', '对立',
];

/** 标签调色板 */
export const TAG_COLORS = [
  '#64748b', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#a855f7', '#84cc16',
];

/** 从标签列表中取出某张卡片的标签名数组 */
export function tagsOf(cardId: Id, links: CardTag[], tags: Tag[]): Tag[] {
  const ids = new Set(links.filter((l) => l.card_id === cardId).map((l) => l.tag_id));
  return tags.filter((t) => ids.has(t.id));
}

/** 判断关联是否命中某张卡片（双向反查） */
export function relationTouches(rel: Relation, cardId: Id): boolean {
  return rel.from_id === cardId || rel.to_id === cardId;
}

/** 把关联转换成以 cardId 为中心的边 */
export function edgeOf(rel: Relation, cardId: Id): RelationEdge {
  return { ...rel, direction: rel.from_id === cardId ? 'outgoing' : 'incoming' };
}

/** 空的关联对象工厂 */
export function emptyRelation(worldId: Id, branchId: Id | null, fromId: Id, toId: Id): Omit<Relation, 'id' | 'created_at'> {
  return {
    world_id: worldId,
    branch_id: branchId,
    from_id: fromId,
    to_id: toId,
    label: '',
    note: '',
    directed: 1,
    start_t: null,
    end_t: null,
  };
}
