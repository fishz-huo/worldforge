/**
 * 大纲文本 ↔ 大纲树 的双向转换
 * ------------------------------------------------------------------
 * 需求 10：大纲既可以直接当 Markdown 文本写，也可以切成树形图。
 * 两种视图共用一份数据：文本里的 `#` 层级就是树的层级。
 *
 * 文本是唯一真相源，所以下面的 `scanOutlineHeadings` 是整套同步的解析内核：
 * 它带字符偏移（跳转用）、重名序号（治同名标题互相覆盖）、
 * 并且跳过围栏代码块、容忍旧版写回的 ✅/❌ 徽章与「> 状态 · 摘要」引用行。
 */
import type { OutlineNode, OutlineTreeNode } from '@/types';

/** 解析出的一级标题 */
export interface ParsedHeading {
  level: number;
  title: string;
  /** 该标题下第一段正文，作为节点摘要 */
  summary: string;
}

/** 带位置信息的标题（同步内核用） */
export interface ScannedHeading extends ParsedHeading {
  /** 原样标题（trim 后，仍带着旧版徽章） */
  rawTitle: string;
  /** 0 基行号 */
  line: number;
  /** 标题行首 / 行尾（不含换行符）的字符偏移 */
  lineStart: number;
  lineEnd: number;
  /** 标题文字本身的起始偏移（`## ` 之后） */
  titleStart: number;
  /** 同名标题里这是第几次出现（0 基） */
  occurrence: number;
}

/** 旧版「写回文本」往标题行尾追加的状态徽章，解析时忽略 */
const BADGE_RE = /\s*[✅❌]+\s*$/;
/** 旧版写在标题下方的「> 已完成 · 摘要」引用行，不能当成摘要 */
const STATUS_QUOTE_RE = /^\s*>\s*(构思|写作中|已完成|已废弃)\s*·/;
/** 围栏代码块开关（``` 或 ~~~） */
const FENCE_RE = /^\s*(```+|~~~+)/;
/** ATX 标题：1~6 个 #，后面必须有空格 */
const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/;

/** 按行切开，同时给出每行的真实起始偏移（CRLF 也准） */
function lineSpans(text: string): { text: string; start: number }[] {
  const spans: { text: string; start: number }[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i += 1) {
    if (i !== text.length && text[i] !== '\n') continue;
    const raw = text.slice(start, i);
    spans.push({ text: raw.endsWith('\r') ? raw.slice(0, -1) : raw, start });
    start = i + 1;
  }
  return spans;
}

/**
 * 扫描出全部标题：跳过围栏代码块内的行，剥离旧版徽章，
 * 记录偏移、层级、重名序号，以及标题下第一段正文（摘要初值）。
 */
export function scanOutlineHeadings(text: string): ScannedHeading[] {
  const result: ScannedHeading[] = [];
  const seen = new Map<string, number>();
  let fence: string | null = null;
  let current: ScannedHeading | null = null;

  lineSpans(text).forEach((span, index) => {
    const fenceMatch = FENCE_RE.exec(span.text);
    if (fenceMatch) {
      // 同类围栏成对开关；异类不打断当前围栏
      if (fence === null) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = null;
      current = null;
      return;
    }
    if (fence !== null) return;

    const heading = HEADING_RE.exec(span.text);
    if (heading) {
      current = null;
      const rawTitle = heading[2].trim();
      const title = rawTitle.replace(BADGE_RE, '').trim();
      // 只敲了「## 」还没写标题：不算节点（去抖期间不会冒出空节点）
      if (!title) return;
      const occurrence = seen.get(title) ?? 0;
      seen.set(title, occurrence + 1);
      const leading = heading[2].length - heading[2].trimStart().length;
      current = {
        level: heading[1].length,
        title,
        summary: '',
        rawTitle,
        line: index,
        lineStart: span.start,
        lineEnd: span.start + span.text.length,
        titleStart: span.start + heading[0].length - heading[2].length + leading,
        occurrence,
      };
      result.push(current);
      return;
    }

    if (current && !current.summary) {
      if (STATUS_QUOTE_RE.test(span.text)) return;
      const plain = span.text.replace(/^\s*[-*+]\s+/, '').trim();
      if (plain && !plain.startsWith('#')) current.summary = plain.slice(0, 120);
    }
  });
  return result;
}

/** 从 Markdown 文本中解析标题结构 */
export function parseOutlineText(text: string): ParsedHeading[] {
  return scanOutlineHeadings(text).map(({ level, title, summary }) => ({ level, title, summary }));
}

/**
 * 把标题序列转换成带父子关系的节点数据。
 * 采用栈维护层级，遇到更深的标题就挂到上一个节点下。
 */
export function headingsToNodes(
  headings: ParsedHeading[],
  makeId: () => string,
  docId: string,
): OutlineNode[] {
  const nodes: OutlineNode[] = [];
  const stack: { level: number; id: string }[] = [];
  const counters = new Map<string, number>();

  headings.forEach((h) => {
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const key = parentId ?? 'root';
    const order = counters.get(key) ?? 0;
    counters.set(key, order + 1);

    const id = makeId();
    nodes.push({
      id,
      doc_id: docId,
      parent_id: parentId,
      order_index: order,
      title: h.title,
      summary: h.summary,
      status: 'idea',
      card_id: null,
      link_doc_id: null,
      meta: {},
    });
    stack.push({ level: h.level, id });
  });
  return nodes;
}

/** 大纲树 → Markdown 文本 */
export function outlineToMarkdown(tree: OutlineTreeNode[], statusLabel: (s: string) => string): string {
  const lines: string[] = [];
  const walk = (nodes: OutlineTreeNode[], depth: number) => {
    nodes.forEach((node) => {
      const hashes = '#'.repeat(Math.min(6, depth + 1));
      const badge = node.status === 'done' ? ' ✅' : node.status === 'cut' ? ' ❌' : '';
      lines.push(`${hashes} ${node.title}${badge}`);
      if (node.summary) lines.push('');
      if (node.summary) lines.push(`> ${statusLabel(node.status)} · ${node.summary}`);
      lines.push('');
      walk(node.children, depth + 1);
    });
  };
  walk(tree, 0);
  return lines.join('\n').trimEnd() + '\n';
}

/**
 * 大纲树 → 干净的 Markdown 文本：只写 `#` 层级 + 标题。
 * 引导条「把树写进文本」用它 —— 不带 ✅/❌ 徽章、不带「> 状态 · 摘要」引用行，
 * 免得再造出「标题被徽章污染、以后再也匹配不上」的旧数据。
 */
export function outlineToCleanMarkdown(tree: OutlineTreeNode[]): string {
  const lines: string[] = [];
  const walk = (nodes: OutlineTreeNode[], depth: number) => {
    nodes.forEach((node) => {
      lines.push(`${'#'.repeat(Math.min(6, depth + 1))} ${node.title.replace(BADGE_RE, '').trim()}`);
      lines.push('');
      walk(node.children, depth + 1);
    });
  };
  walk(tree, 0);
  return lines.join('\n').trimEnd() + '\n';
}

/** 统计文本大纲的层级分布，用于概览展示 */
export function headingStats(headings: ParsedHeading[]): { level: number; count: number }[] {
  const map = new Map<number, number>();
  headings.forEach((h) => map.set(h.level, (map.get(h.level) ?? 0) + 1));
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([level, count]) => ({ level, count }));
}
