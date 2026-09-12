/**
 * 文稿（Doc）与大纲节点（OutlineNode）
 * ------------------------------------------------------------------
 * 需求 6 / 10：
 *  - docs 承载写作层的正文（kind='manuscript'）与大纲文本（kind='outline'）。
 *  - 正文与大綱共用同一套 Markdown 编辑器，做到「零切换」。
 *  - outline_nodes 是一棵可排序的树，同一份数据支持三种呈现：
 *    文本视图、树形视图、思维导图视图。
 */
import type { Id, Stamps } from './common';

/** 文稿类别 */
export type DocKind = 'manuscript' | 'outline' | 'note';

/** 文稿类别元信息 */
export const DOC_KINDS: { kind: DocKind; label: string; icon: string }[] = [
  { kind: 'manuscript', label: '正文', icon: 'FileText' },
  { kind: 'outline', label: '大纲', icon: 'ListTree' },
  { kind: 'note', label: '笔记', icon: 'StickyNote' },
];

/** 文稿 */
export interface Doc extends Stamps {
  id: Id;
  world_id: Id;
  branch_id: Id | null;
  kind: DocKind;
  title: string;
  /** Markdown 正文，支持 [[卡片标题]] 双链 */
  content: string;
  summary: string;
  order_index: number;
  /** 大纲文稿可关联到某个分支剧情线卡片 */
  card_id: Id | null;
}

/** 大纲节点状态 */
export type OutlineStatus = 'idea' | 'draft' | 'done' | 'cut';

/** 大纲状态元信息（颜色用于树与思维导图） */
export const OUTLINE_STATUS: { status: OutlineStatus; label: string; color: string }[] = [
  { status: 'idea', label: '构思', color: '#64748b' },
  { status: 'draft', label: '写作中', color: '#f59e0b' },
  { status: 'done', label: '已完成', color: '#10b981' },
  { status: 'cut', label: '已废弃', color: '#ef4444' },
];

/** 大纲节点 */
export interface OutlineNode {
  id: Id;
  doc_id: Id;
  /** 父节点；null 表示根节点 */
  parent_id: Id | null;
  order_index: number;
  title: string;
  summary: string;
  status: OutlineStatus;
  /** 可挂接一张卡片（人物/地点/事件），实现大纲与设定的双向跳转 */
  card_id: Id | null;
  /** 关联的正文文稿，实现「大纲 → 正文」直达 */
  link_doc_id: Id | null;
  /** 自由元数据，如目标字数 */
  meta: Record<string, unknown>;
}

/** 树形结构包装 */
export interface OutlineTreeNode extends OutlineNode {
  children: OutlineTreeNode[];
  depth: number;
}

/** 把扁平节点数组构建成树（按 order_index 排序） */
export function buildOutlineTree(nodes: OutlineNode[]): OutlineTreeNode[] {
  const map = new Map<Id, OutlineTreeNode>();
  nodes.forEach((n) => map.set(n.id, { ...n, children: [], depth: 0 }));
  const roots: OutlineTreeNode[] = [];
  map.forEach((node) => {
    const parent = node.parent_id ? map.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const sortRec = (list: OutlineTreeNode[], depth: number) => {
    list.sort((a, b) => a.order_index - b.order_index);
    list.forEach((n) => {
      n.depth = depth;
      sortRec(n.children, depth + 1);
    });
  };
  sortRec(roots, 0);
  return roots;
}

/** 统计大纲完成度，用于进度条 */
export function outlineProgress(nodes: OutlineNode[]): { done: number; total: number; percent: number } {
  const total = nodes.length;
  const done = nodes.filter((n) => n.status === 'done').length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
