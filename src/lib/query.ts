/**
 * 纯查询函数
 * ------------------------------------------------------------------
 * 所有派生数据都在这里以「纯函数」形式实现：
 * 组件用 useMemo 调用它们，既避免 zustand selector 造成的新引用问题，
 * 也方便单元测试与插件复用。
 */
import type { Card, CardTag, Relation, RelationEdge, Tag, TimelineEntry } from '@/types';
import { edgeOf } from '@/types';
import { matches } from './utils';

/** 卡片筛选条件 */
export interface CardFilter {
  /** 卡片类型；null = 全部 */
  type?: string | null;
  /** 必须同时具备的标签（AND 语义）；空数组 = 不限 */
  tagIds?: string[];
  /** 关键词（标题 / 副标题 / 摘要 / 正文 / 字段） */
  search?: string;
  /** 当前分支 id；null 表示主世界 */
  branchId?: string | null;
  /** current = 主世界 + 当前分支；all = 全部平行世界 */
  branchScope?: 'current' | 'all';
  /** 仅显示置顶 */
  pinnedOnly?: boolean;
}

/** 卡片的全文本（用于搜索与关键词命中） */
export function cardText(card: Card): string {
  const fieldText = Object.values(card.fields ?? {})
    .map((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')))
    .join(' ');
  return [card.title, card.subtitle, card.summary, card.body, fieldText].join('\n');
}

/** 按条件筛选卡片 */
export function filterCards(cards: Card[], cardTags: CardTag[], filter: CardFilter): Card[] {
  const { type = null, tagIds = [], search = '', branchId = null, branchScope = 'current', pinnedOnly = false } = filter;
  // 分支可见性：主世界卡片在所有分支下都可见；分支卡片只在自己的分支可见
  const visibleIds =
    branchScope === 'all'
      ? null
      : new Set(
          cards
            .filter((c) => c.branch_id === null || c.branch_id === branchId)
            .map((c) => c.id),
        );
  const tagMap = new Map<string, Set<string>>();
  cardTags.forEach((ct) => {
    const set = tagMap.get(ct.card_id) ?? new Set<string>();
    set.add(ct.tag_id);
    tagMap.set(ct.card_id, set);
  });

  return cards.filter((card) => {
    if (visibleIds && !visibleIds.has(card.id)) return false;
    if (type && card.type !== type) return false;
    if (pinnedOnly && !card.pinned) return false;
    if (tagIds.length) {
      const owned = tagMap.get(card.id) ?? new Set<string>();
      if (!tagIds.every((t) => owned.has(t))) return false;
    }
    if (search && !matches(search, cardText(card))) return false;
    return true;
  });
}

/** 取某张卡片的标签对象数组 */
export function tagsOfCard(cardId: string, cardTags: CardTag[], tags: Tag[]): Tag[] {
  const ids = new Set(cardTags.filter((ct) => ct.card_id === cardId).map((ct) => ct.tag_id));
  return tags.filter((t) => ids.has(t.id));
}

/** 取某张卡片的关联（双向），并标注方向 */
export function relationsOfCard(cardId: string, relations: Relation[]): RelationEdge[] {
  return relations
    .filter((r) => r.from_id === cardId || r.to_id === cardId)
    .map((r) => edgeOf(r, cardId));
}

/** 关联的「另一端」卡片 id */
export function otherEnd(edge: RelationEdge, cardId: string): string {
  return edge.from_id === cardId ? edge.to_id : edge.from_id;
}

/** 建立「标题 → 卡片」索引，供 [[双链]] 与悬浮预览使用 */
export function buildTitleIndex(cards: Card[]): Map<string, Card> {
  const map = new Map<string, Card>();
  cards.forEach((c) => {
    if (!c.title) return;
    map.set(c.title, c);
    // 同时接受去掉书名号/括号的写法，降低输入成本
    const loose = c.title.replace(/^[《【\[]|[》】\]]$/g, '');
    if (loose && !map.has(loose)) map.set(loose, c);
  });
  return map;
}

/** 找出文本中提到过的卡片（按标题命中，长标题优先，避免子串误伤） */
export function findMentionedCards(text: string, cards: Card[], limit = 24): Card[] {
  if (!text) return [];
  const found: Card[] = [];
  const sorted = [...cards].sort((a, b) => b.title.length - a.title.length);
  const seen = new Set<string>();
  const lower = text.toLowerCase();
  for (const card of sorted) {
    if (!card.title || card.title.length < 2 || seen.has(card.id)) continue;
    if (lower.includes(card.title.toLowerCase())) {
      found.push(card);
      seen.add(card.id);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/** 时间轴条目按泳道分组 */
export function groupEntriesByTrack(entries: TimelineEntry[]): Map<string, TimelineEntry[]> {
  const map = new Map<string, TimelineEntry[]>();
  entries.forEach((e) => {
    const list = map.get(e.track_id) ?? [];
    list.push(e);
    map.set(e.track_id, list);
  });
  return map;
}

/** 计算某泳道所有条目的刻度范围，用于自动适配视口 */
export function entryRange(entries: TimelineEntry[]): [number, number] {
  if (entries.length === 0) return [0, 100];
  let min = Infinity;
  let max = -Infinity;
  entries.forEach((e) => {
    min = Math.min(min, e.start_t);
    max = Math.max(max, e.end_t ?? e.start_t);
  });
  if (min === max) return [min - 10, max + 10];
  return [min, max];
}
