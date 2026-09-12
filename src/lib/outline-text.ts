/**
 * 大纲文本 ↔ 大纲树 的双向转换
 * ------------------------------------------------------------------
 * 需求 10：大纲既可以直接当 Markdown 文本写，也可以切成树形图。
 * 两种视图共用一份数据：文本里的 `#` 层级就是树的层级。
 */
import type { OutlineNode, OutlineTreeNode } from '@/types';

/** 解析出的一级标题 */
export interface ParsedHeading {
  level: number;
  title: string;
  /** 该标题下第一段正文，作为节点摘要 */
  summary: string;
}

/** 从 Markdown 文本中解析标题结构 */
export function parseOutlineText(text: string): ParsedHeading[] {
  const lines = text.split(/\r?\n/);
  const result: ParsedHeading[] = [];
  let current: ParsedHeading | null = null;
  lines.forEach((line) => {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      current = { level: heading[1].length, title: heading[2].trim(), summary: '' };
      result.push(current);
      return;
    }
    // 标题后的第一个非空、非列表行作为摘要
    if (current && !current.summary) {
      const plain = line.replace(/^\s*[-*+]\s+/, '').trim();
      if (plain && !plain.startsWith('#')) current.summary = plain.slice(0, 120);
    }
  });
  return result;
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

/** 统计文本大纲的层级分布，用于概览展示 */
export function headingStats(headings: ParsedHeading[]): { level: number; count: number }[] {
  const map = new Map<number, number>();
  headings.forEach((h) => map.set(h.level, (map.get(h.level) ?? 0) + 1));
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([level, count]) => ({ level, count }));
}
