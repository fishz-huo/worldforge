/**
 * 文档导出：内容采集（宿主数据 → ExportArea）
 * ==================================================================
 * 把内存里的卡片 / 文稿 / 大纲节点整理成「区域 → 条目 → 正文」的三层结构，
 * 后面三种格式（Markdown / 纯文本 / Word、以及打印成 PDF 的 HTML）都只认这个结构，
 * 于是「导出什么」与「导出成什么格式」彻底解耦。
 *
 * 这里刻意做成**纯函数**（数据从参数进来，不碰 store、不碰 DOM）：
 * 导出是最怕出错的功能（内容少了、串行了都很难发现），纯函数才能在 Node 里
 * 用真实数据反复自测，见 scripts/export-selftest.mjs。
 *
 * 与「预览」的关系：正文一律原样保留 Markdown 原文，绝不在采集阶段改写，
 * 这样导出的 .md 可以直接当备份、也能原样回灌；只有排版层（HTML / Word）
 * 才会为了让层级好看而把正文里的标题降级（见 build.ts 的 shiftHeadings）。
 */
import type { Card, Doc, FieldDef, FieldValue } from '@/types';
import {
  ALL_AREAS, AREA_HINTS, AREA_LABELS, OUTLINE_STATUS, buildOutlineTree,
  type ExportArea, type ExportAreaId, type ExportItem, type ExportMeta, type ExportSource,
} from '@/types';
import { countWords } from '@/lib/markdown';
import { outlineToMarkdown } from '@/lib/outline-text';
import { getCardType, getFieldsFor, listCardTypes } from '@/lib/plugin/registry';

/** 采集选项 */
export interface CollectOptions {
  /** 卡片条目里带上标签与关联（默认 true） */
  includeRelations?: boolean;
  /** 只导出当前分支可见的条目（默认 false：全部都导） */
  branchOnly?: boolean;
}

/**
 * 分支过滤。
 * 默认**不过滤**：导出是「备份」性质的活儿，宁可多导也不能悄悄少导，
 * 所以只有用户显式勾了「只导出当前分支」才排除别的分支。
 * 主世界内容（branch_id 为空）在任何分支视角下都算可见。
 */
function inBranch(branchId: string | null | undefined, source: ExportSource, opts: CollectOptions): boolean {
  if (!opts.branchOnly) return true;
  if (!source.branchId) return true;
  return !branchId || branchId === source.branchId;
}

/** 字段值 → 可读文本；返回空串表示这个字段没填，直接跳过 */
function fieldText(raw: FieldValue | undefined, def: FieldDef): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (Array.isArray(raw)) return raw.filter((x) => x !== '' && x !== null).join('、');
  if (def.kind === 'boolean') return raw ? '是' : '否';
  // 下拉项存的是 value，导出给人看要用 label（找不到就退回原值，插件加的字段可能没给 options）
  if (def.kind === 'select') return def.options?.find((o) => o.value === String(raw))?.label ?? String(raw);
  return String(raw);
}

/** 标签名（保持用户在标签库里定的名字） */
function tagsOfCard(cardId: string, source: ExportSource): string[] {
  const ids = new Set(source.cardTags.filter((l) => l.card_id === cardId).map((l) => l.tag_id));
  return source.tags.filter((t) => ids.has(t.id)).map((t) => t.name);
}

/** 关联卡片：把「关系名 + 对端标题」写成一行，方向用箭头区分 */
function relationsOfCard(cardId: string, source: ExportSource): string[] {
  const titleOf = (id: string) => source.cards.find((c) => c.id === id)?.title ?? '（已删除的卡片）';
  return source.relations
    .filter((r) => r.from_id === cardId || r.to_id === cardId)
    .map((r) => {
      const label = r.label || '关联';
      if (r.from_id === cardId && r.to_id === cardId) return `${label}：自己`;
      return r.from_id === cardId ? `→ ${label}：${titleOf(r.to_id)}` : `← ${label}：${titleOf(r.from_id)}`;
    });
}

/** 一张卡片 → 一个条目 */
function cardToItem(card: Card, source: ExportSource, opts: CollectOptions): ExportItem {
  const type = getCardType(card.type);
  const meta: ExportMeta[] = [{ label: '类型', value: type.label }];
  if (card.subtitle) meta.push({ label: '副标题', value: card.subtitle });
  if (card.summary) meta.push({ label: type.summaryLabel ?? '摘要', value: card.summary });
  // 字段顺序 = 卡片详情页里的顺序，用户看到的与导出的对得上
  getFieldsFor(card.type).forEach((def) => {
    const value = fieldText(card.fields?.[def.key], def);
    if (value) meta.push({ label: def.label, value });
  });
  return {
    id: card.id,
    title: card.title,
    subtitle: '',
    meta,
    markdown: card.body ?? '',
    tags: opts.includeRelations === false ? [] : tagsOfCard(card.id, source),
    relations: opts.includeRelations === false ? [] : relationsOfCard(card.id, source),
  };
}

/** 一篇文稿（正文 / 笔记）→ 一个条目 */
function docToItem(doc: Doc, source: ExportSource): ExportItem {
  const meta: ExportMeta[] = [];
  if (doc.summary) meta.push({ label: '摘要', value: doc.summary });
  const linked = doc.card_id ? source.cards.find((c) => c.id === doc.card_id) : null;
  if (linked) meta.push({ label: '关联卡片', value: linked.title });
  meta.push({ label: '字数', value: `${countWords(doc.content ?? '')} 字` });
  return {
    id: doc.id,
    title: doc.title,
    subtitle: '',
    meta,
    markdown: doc.content ?? '',
    tags: [],
    relations: [],
  };
}

/**
 * 一篇大纲 → 一个条目。
 * 大纲有两份等价数据：doc.content 里的文本，与 outline_nodes 里的树。
 * 树更「全」（带状态、卡片挂接），所以有节点时以树为准，没有才退回原文。
 */
function outlineToItem(doc: Doc, source: ExportSource): ExportItem {
  const nodes = source.outlineNodes.filter((n) => n.doc_id === doc.id);
  const label = (s: string) => OUTLINE_STATUS.find((x) => x.status === s)?.label ?? s;
  const markdown = nodes.length
    ? outlineToMarkdown(buildOutlineTree(nodes), label)
    : doc.content ?? '';
  const meta: ExportMeta[] = [{ label: '节点数', value: `${nodes.length} 个` }];
  const done = nodes.filter((n) => n.status === 'done').length;
  if (nodes.length) meta.push({ label: '已完成', value: `${done} / ${nodes.length}` });
  const linked = doc.card_id ? source.cards.find((c) => c.id === doc.card_id) : null;
  if (linked) meta.push({ label: '关联卡片', value: linked.title });
  if (doc.summary) meta.push({ label: '摘要', value: doc.summary });
  return { id: doc.id, title: doc.title, subtitle: '', meta, markdown, tags: [], relations: [] };
}

/** 采集某一个区域；没有内容时返回 null（界面上显示为「空」，不生成空文件） */
function collectArea(id: ExportAreaId, source: ExportSource, opts: CollectOptions): ExportArea | null {
  const docs = source.docs.filter((d) => inBranch(d.branch_id, source, opts));
  let items: ExportItem[] = [];
  let pageBreakPerItem = false;

  if (id === 'cards') {
    // 类型顺序 = 卡片库里的类型顺序（内置类型在前，插件注册的在后）。
    // 不用类型名做拼音排序：那样「地点」会排到「角色」前面，与用户熟悉的顺序不一致。
    const typeRank = new Map(listCardTypes().map((t, i) => [t.type, i]));
    items = source.cards
      .filter((c) => inBranch(c.branch_id, source, opts))
      .map((c) => ({ item: cardToItem(c, source, opts), rank: typeRank.get(c.type) ?? 999 }))
      .sort((a, b) => (a.rank === b.rank
        ? a.item.title.localeCompare(b.item.title, 'zh')
        : a.rank - b.rank))
      .map((x) => x.item);
  } else if (id === 'manuscript' || id === 'notes') {
    const kind = id === 'manuscript' ? 'manuscript' : 'note';
    items = docs.filter((d) => d.kind === kind).map((d) => docToItem(d, source));
    pageBreakPerItem = true; // 正文按章节另起一页
  } else {
    items = docs.filter((d) => d.kind === 'outline').map((d) => outlineToItem(d, source));
    pageBreakPerItem = true;
  }

  if (items.length === 0) return null;
  return { id, title: AREA_LABELS[id], items, pageBreakPerItem };
}

/** 采集全部区域（顺序固定，界面上按这个顺序展示） */
export function collectAreas(source: ExportSource, opts: CollectOptions = {}): ExportArea[] {
  return ALL_AREAS.map((id) => collectArea(id, source, opts)).filter((a): a is ExportArea => a !== null);
}

/** 区域摘要（给勾选界面用：条目数 + 字数，不搬正文） */
export function summarizeAreas(source: ExportSource, opts: CollectOptions = {}) {
  return ALL_AREAS.map((id) => {
    const area = collectArea(id, source, opts);
    const words = area ? area.items.reduce((sum, it) => sum + countWords(it.markdown), 0) : 0;
    return { id, title: AREA_LABELS[id], hint: AREA_HINTS[id], count: area?.items.length ?? 0, words };
  });
}
