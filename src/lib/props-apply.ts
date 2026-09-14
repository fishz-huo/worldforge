/**
 * 卡片属性区 · 应用到卡片
 * ==================================================================
 * 把「属性区文本」解析出来的内容写回卡片。这是**单向投影**的落点：
 *   - 结构化字段 / 类型名 / 副标题 / 摘要 → 直接合并进 cards.fields 等列；
 *   - 标签 → 按名字查标签库，库里没有的自动建（ensureTag），
 *     与卡片原有的标签**取并集**（不删除，避免误删）；
 *   - 关联 → 按 id 优先、标题兜底找到对端卡片：
 *       已存在同向同关系名的关联就更新备注，否则新建；
 *       属性区里没有、而卡片有的关联**不动**（同样是怕误删）。
 *
 * 为什么不做成"文本即真相、多余的都删掉"：属性区多半是从导出的 Markdown
 * 粘回来的，里面很可能只写了作者关心的那几条。删掉没写的关联
 * 会造成"粘一次少一半"的静默数据丢失，而用户根本不会注意到。
 */
import type { Card, FieldValue, Relation } from '@/types';
import type { CardProps, RelationRef } from '@/lib/markdown';

/** 应用时需要的最小 store 能力（便于自测里传假实现） */
export interface PropsApplyEnv {
  cards: Card[];
  relations: Relation[];
  /** 按名字取标签，没有就建一个 */
  ensureTag: (name: string) => { id: string };
  setCardTagsOf: (cardId: string, tagIds: string[]) => void;
  addRelation: (input: { from_id: string; to_id: string; label: string; note?: string }) => void;
  updateRelation: (id: string, patch: Partial<Relation>) => void;
  updateCard: (id: string, patch: Partial<Card>) => void;
  /** 卡片原有的标签 id */
  existingTagIds: string[];
}

/** 应用结果（给界面提示用） */
export interface ApplyReport {
  fields: number;
  tagsAdded: number;
  relationsAdded: number;
  relationsUpdated: number;
  /** 找不到对端卡片的关联标题 */
  unresolved: string[];
}

/** 按 id 或标题找对端卡片 */
function findTarget(ref: RelationRef, cardId: string, cards: Card[]): Card | null {
  if (ref.id) {
    const byId = cards.find((c) => c.id === ref.id && c.id !== cardId);
    if (byId) return byId;
  }
  return cards.find((c) => c.title === ref.title && c.id !== cardId) ?? null;
}

/**
 * 把属性区的字段合并进卡片（返回新的 fields 对象）。
 * 空值会被清掉：不然 fields 里会越堆越多空字符串，导出时多出一堆空行。
 */
export function mergePropsFields(card: Card, props: CardProps): Record<string, FieldValue> {
  const merged: Record<string, FieldValue> = { ...card.fields, ...props.fields };
  if (props.typeLabel) merged.typeLabel = props.typeLabel;
  (Object.keys(merged) as string[]).forEach((key) => {
    const value = merged[key];
    if (value === '' || value === null || value === undefined) delete merged[key];
    else if (Array.isArray(value) && value.length === 0) delete merged[key];
  });
  // __type 是空卡片建立时写入的类型标记，改类型时要跟着走
  merged.__type = props.type ?? card.type;
  return merged;
}

/** 应用标签（并集），返回新增数量 */
function applyTags(card: Card, props: CardProps, env: PropsApplyEnv): number {
  if (!props.tags || props.tags.length === 0) return 0;
  const before = new Set(env.existingTagIds);
  const ids = new Set(env.existingTagIds);
  props.tags.forEach((name) => ids.add(env.ensureTag(name).id));
  const added = [...ids].filter((id) => !before.has(id)).length;
  env.setCardTagsOf(card.id, [...ids]);
  return added;
}

/** 应用关联（按 id / 标题匹配） */
function applyRelations(card: Card, props: CardProps, env: PropsApplyEnv) {
  let added = 0;
  let updated = 0;
  const unresolved: string[] = [];
  props.relations.forEach((ref) => {
    const target = findTarget(ref, card.id, env.cards);
    if (!target) {
      unresolved.push(ref.title);
      return;
    }
    // 出边：当前卡片 → 对端；入边：对端 → 当前卡片
    const fromId = ref.arrow === '←' ? target.id : card.id;
    const toId = ref.arrow === '←' ? card.id : target.id;
    const exists = env.relations.find(
      (r) => r.from_id === fromId && r.to_id === toId && (r.label || '关联') === ref.label,
    );
    if (exists) {
      if ((exists.note ?? '') !== ref.note) {
        env.updateRelation(exists.id, { note: ref.note });
        updated += 1;
      }
      return;
    }
    env.addRelation({ from_id: fromId, to_id: toId, label: ref.label, note: ref.note });
    added += 1;
  });
  return { relationsAdded: added, relationsUpdated: updated, unresolved };
}

/** 把属性区解析结果写回卡片；返回改了些什么 */
export function applyProps(card: Card, props: CardProps, env: PropsApplyEnv): ApplyReport {
  const patch: Partial<Card> = { fields: mergePropsFields(card, props) };
  if (props.subtitle !== null) patch.subtitle = props.subtitle;
  if (props.summary !== null) patch.summary = props.summary;
  // 类型只在文本里明确写了、且与当前不同时才改
  if (props.type && props.type !== card.type) patch.type = props.type;
  env.updateCard(card.id, patch);

  const tagsAdded = applyTags(card, props, env);
  const rel = applyRelations(card, props, env);
  return { fields: Object.keys(props.fields).length, tagsAdded, ...rel };
}
