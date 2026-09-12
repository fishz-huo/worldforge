/**
 * 快照结构差异
 * ------------------------------------------------------------------
 * 需求 12：把历史版本与当前设定做对比。
 * 不只是「文本 diff」：这里按实体比对，告诉你
 *  新增了哪些卡片 / 删除了哪些 / 哪些卡片的哪些字段被改了。
 */
import type { Card, SnapshotPayload } from '@/types';
import { diffLines, type DiffLine } from './diff';

/** 单张卡片的变化 */
export interface CardChange {
  before: Card;
  after: Card;
  /** 发生变化的字段名（含 title/summary/body/tags 等） */
  fields: string[];
}

/** 差异结果 */
export interface SnapshotDiff {
  cards: { added: Card[]; removed: Card[]; changed: CardChange[] };
  tags: { added: string[]; removed: string[] };
  relations: { added: number; removed: number; changed: number };
  maps: { added: string[]; removed: string[]; changed: string[] };
  entries: { added: number; removed: number; changed: number };
  docs: { added: string[]; removed: string[]; changed: { title: string; lines: DiffLine[] }[] };
  outline: { added: number; removed: number; changed: number };
  total: number;
}

/** 取数组中的 id */
function indexById<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((item) => [item.id, item]));
}

/** 比较两张卡片，返回变化的字段名 */
function changedFields(before: Card, after: Card): string[] {
  const keys: (keyof Card)[] = ['title', 'subtitle', 'summary', 'body', 'type', 'fields', 'cover_asset', 'branch_id', 'pinned'];
  const changed: string[] = [];
  keys.forEach((key) => {
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) changed.push(String(key));
  });
  return changed;
}

/** 计算两个快照之间的差异 */
export function diffSnapshots(before: SnapshotPayload, after: SnapshotPayload): SnapshotDiff {
  const beforeCards = before.cards as Card[];
  const afterCards = after.cards as Card[];
  const aCards = indexById(beforeCards);
  const bCards = indexById(afterCards);

  const added: Card[] = [];
  const removed: Card[] = [];
  const changed: CardChange[] = [];
  bCards.forEach((card, id) => {
    const old = aCards.get(id);
    if (!old) added.push(card);
    else {
      const fields = changedFields(old, card);
      if (fields.length) changed.push({ before: old, after: card, fields });
    }
  });
  aCards.forEach((card, id) => {
    if (!bCards.has(id)) removed.push(card);
  });

  const nameOf = (list: unknown, key = 'name'): string[] =>
    (list as Record<string, string>[]).map((item) => item[key] ?? item.id);

  const aTags = new Set(nameOf(before.tags));
  const bTags = new Set(nameOf(after.tags));

  const aMaps = indexById(before.maps as { id: string; name: string }[]);
  const bMaps = indexById(after.maps as { id: string; name: string }[]);

  const aDocs = indexById(before.docs as { id: string; title: string; content: string }[]);
  const bDocs = indexById(after.docs as { id: string; title: string; content: string }[]);
  const docChanges: { title: string; lines: DiffLine[] }[] = [];
  bDocs.forEach((doc, id) => {
    const old = aDocs.get(id);
    if (old && old.content !== doc.content) {
      docChanges.push({ title: doc.title, lines: diffLines(old.content, doc.content) });
    }
  });

  const diff: SnapshotDiff = {
    cards: { added, removed, changed },
    tags: {
      added: [...bTags].filter((t) => !aTags.has(t)),
      removed: [...aTags].filter((t) => !bTags.has(t)),
    },
    relations: {
      added: (after.relations as { id: string }[]).filter((r) => !indexById(before.relations as { id: string }[]).has(r.id)).length,
      removed: (before.relations as { id: string }[]).filter((r) => !indexById(after.relations as { id: string }[]).has(r.id)).length,
      changed: 0,
    },
    maps: {
      added: [...bMaps.keys()].filter((id) => !aMaps.has(id)).map((id) => bMaps.get(id)!.name),
      removed: [...aMaps.keys()].filter((id) => !bMaps.has(id)).map((id) => aMaps.get(id)!.name),
      changed: [...bMaps.keys()]
        .filter((id) => aMaps.has(id) && JSON.stringify(aMaps.get(id)) !== JSON.stringify(bMaps.get(id)))
        .map((id) => bMaps.get(id)!.name),
    },
    entries: {
      added: (after.entries as { id: string }[]).filter((e) => !(before.entries as { id: string }[]).some((x) => x.id === e.id)).length,
      removed: (before.entries as { id: string }[]).filter((e) => !(after.entries as { id: string }[]).some((x) => x.id === e.id)).length,
      changed: 0,
    },
    docs: {
      added: [...bDocs.keys()].filter((id) => !aDocs.has(id)).map((id) => bDocs.get(id)!.title),
      removed: [...aDocs.keys()].filter((id) => !bDocs.has(id)).map((id) => aDocs.get(id)!.title),
      changed: docChanges,
    },
    outline: {
      added: (after.outlineNodes as { id: string }[]).filter((n) => !(before.outlineNodes as { id: string }[]).some((x) => x.id === n.id)).length,
      removed: (before.outlineNodes as { id: string }[]).filter((n) => !(after.outlineNodes as { id: string }[]).some((x) => x.id === n.id)).length,
      changed: (after.outlineNodes as { id: string; title: string }[]).filter((n) => {
        const old = (before.outlineNodes as { id: string; title: string }[]).find((x) => x.id === n.id);
        return old && old.title !== n.title;
      }).length,
    },
    total: 0,
  };

  diff.total =
    added.length + removed.length + changed.length +
    diff.tags.added.length + diff.tags.removed.length +
    diff.relations.added + diff.relations.removed +
    diff.maps.added.length + diff.maps.removed.length + diff.maps.changed.length +
    diff.entries.added + diff.entries.removed +
    diff.docs.added.length + diff.docs.removed.length + diff.docs.changed.length +
    diff.outline.added + diff.outline.removed + diff.outline.changed;

  return diff;
}

/** 字段名 → 中文标签 */
export const FIELD_LABELS: Record<string, string> = {
  title: '标题',
  subtitle: '副标题',
  summary: '摘要',
  body: '正文',
  type: '类型',
  fields: '结构化字段',
  cover_asset: '封面',
  branch_id: '所属分支',
  pinned: '置顶',
};

/** 找出结构化字段里具体变动的键 */
export function changedFieldKeys(before: Card, after: Card): string[] {
  const a = before.fields ?? {};
  const b = after.fields ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
}
