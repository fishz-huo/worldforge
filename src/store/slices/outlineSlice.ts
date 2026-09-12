/**
 * Outline Slice —— 大纲树的节点操作
 * ------------------------------------------------------------------
 * 需求 10：大纲可写、可切树形、可与文本互相转换。
 * 数据结构：outline_nodes 是一棵「按 parent_id + order_index 排序」的树，
 * 同一份数据支撑文本 / 树形 / 思维导图三种视图。
 */
import type { OutlineNode, OutlineStatus } from '@/types';
import { buildOutlineTree } from '@/types';
import { newOutlineId } from '@/lib/id';
import { outlineRepo } from '@/lib/db';
import { headingsToNodes, outlineToMarkdown, parseOutlineText } from '@/lib/outline-text';
import { nextOrder, upsert } from '../helpers';
import type { Slice } from '../types';

/** 状态 → 中文标签（写回 Markdown 时用） */
const STATUS_LABEL: Record<string, string> = {
  idea: '构思',
  draft: '写作中',
  done: '已完成',
  cut: '已废弃',
};

export interface OutlineSlice {
  /** 新建大纲节点 */
  addOutlineNode: (docId: string, parentId: string | null, title?: string) => string;
  updateOutlineNode: (id: string, patch: Partial<OutlineNode>) => void;
  /** 删除节点及其全部子节点 */
  deleteOutlineNode: (id: string) => void;
  /** 同级上移 / 下移 */
  moveOutlineNode: (id: string, direction: 'up' | 'down') => void;
  /** 提升 / 降低层级（delta = 1 降级，-1 提升） */
  indentOutlineNode: (id: string, delta: 1 | -1) => void;
  /** 用正文里的 Markdown 标题重建大纲树，返回节点数 */
  outlineFromText: (docId: string) => number;
  /** 把大纲树写回 Markdown 文本 */
  textFromOutline: (docId: string) => void;
}

export const createOutlineSlice: Slice<OutlineSlice> = (set, get) => ({
  addOutlineNode: (docId, parentId, title = '新节点') => {
    const siblings = get().outlineNodes.filter((n) => n.doc_id === docId && n.parent_id === parentId);
    const node: OutlineNode = {
      id: newOutlineId(),
      doc_id: docId,
      parent_id: parentId,
      order_index: nextOrder(siblings),
      title,
      summary: '',
      status: 'idea' as OutlineStatus,
      card_id: null,
      link_doc_id: null,
      meta: {},
    };
    outlineRepo.save(node);
    set({ outlineNodes: [...get().outlineNodes, node], selectedOutlineId: node.id });
    return node.id;
  },

  updateOutlineNode: (id, patch) => {
    const node = get().outlineNodes.find((n) => n.id === id);
    if (!node) return;
    const next = { ...node, ...patch };
    outlineRepo.save(next);
    set({ outlineNodes: upsert(get().outlineNodes, next) });
  },

  deleteOutlineNode: (id) => {
    const all = get().outlineNodes;
    // 收集自身与所有后代（循环直到不再增长，兼容任意深度）
    const doomed = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      all.forEach((n) => {
        if (n.parent_id && doomed.has(n.parent_id) && !doomed.has(n.id)) {
          doomed.add(n.id);
          grew = true;
        }
      });
    }
    doomed.forEach((nodeId) => outlineRepo.remove(nodeId));
    set({
      outlineNodes: all.filter((n) => !doomed.has(n.id)),
      selectedOutlineId: doomed.has(get().selectedOutlineId ?? '') ? null : get().selectedOutlineId,
    });
  },

  moveOutlineNode: (id, direction) => {
    const node = get().outlineNodes.find((n) => n.id === id);
    if (!node) return;
    const siblings = get()
      .outlineNodes.filter((n) => n.doc_id === node.doc_id && n.parent_id === node.parent_id)
      .sort((a, b) => a.order_index - b.order_index);
    const index = siblings.findIndex((n) => n.id === id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= siblings.length) return;
    const reordered = siblings.slice();
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const updates = reordered.map((n, i) => ({ ...n, order_index: i }));
    outlineRepo.saveMany(updates);
    set({ outlineNodes: get().outlineNodes.map((n) => updates.find((u) => u.id === n.id) ?? n) });
  },

  indentOutlineNode: (id, delta) => {
    const node = get().outlineNodes.find((n) => n.id === id);
    if (!node) return;
    const all = get().outlineNodes;
    const siblings = all
      .filter((n) => n.doc_id === node.doc_id && n.parent_id === node.parent_id)
      .sort((a, b) => a.order_index - b.order_index);
    const index = siblings.findIndex((n) => n.id === id);

    if (delta === 1) {
      // 降级：成为前一个兄弟节点的子节点
      if (index <= 0) return;
      const newParent = siblings[index - 1];
      const children = all.filter((n) => n.parent_id === newParent.id);
      get().updateOutlineNode(id, { parent_id: newParent.id, order_index: nextOrder(children) });
      return;
    }

    // 提升：成为父节点的下一个兄弟
    if (!node.parent_id) return;
    const parent = all.find((n) => n.id === node.parent_id);
    if (!parent) return;
    get().updateOutlineNode(id, { parent_id: parent.parent_id, order_index: parent.order_index + 0.5 });
    // 规整排序值，避免小数长期累积
    const level = all
      .filter((n) => n.doc_id === node.doc_id && n.parent_id === parent.parent_id)
      .sort((a, b) => a.order_index - b.order_index);
    const normalized = level.map((n, i) => ({ ...n, order_index: i }));
    outlineRepo.saveMany(normalized);
    set({ outlineNodes: get().outlineNodes.map((n) => normalized.find((u) => u.id === n.id) ?? n) });
  },

  outlineFromText: (docId) => {
    const doc = get().docs.find((d) => d.id === docId);
    if (!doc) return 0;
    const headings = parseOutlineText(doc.content);
    if (headings.length === 0) {
      get().toast('正文里没有找到 Markdown 标题（# / ## / ###）', 'warn');
      return 0;
    }
    // 保留已有节点的状态与卡片挂接：按标题文本匹配
    const previous = new Map(
      get().outlineNodes.filter((n) => n.doc_id === docId).map((n) => [n.title, n]),
    );
    const nodes = headingsToNodes(headings, newOutlineId, docId).map((n) => {
      const old = previous.get(n.title);
      return old
        ? { ...n, status: old.status, card_id: old.card_id, summary: n.summary || old.summary }
        : n;
    });
    outlineRepo.removeWhere('doc_id = ?', [docId]);
    outlineRepo.saveMany(nodes);
    set({ outlineNodes: [...get().outlineNodes.filter((n) => n.doc_id !== docId), ...nodes] });
    get().toast(`已从正文同步 ${nodes.length} 个大纲节点`, 'success');
    return nodes.length;
  },

  textFromOutline: (docId) => {
    const doc = get().docs.find((d) => d.id === docId);
    if (!doc) return;
    const tree = buildOutlineTree(get().outlineNodes.filter((n) => n.doc_id === docId));
    const label = (s: string) => STATUS_LABEL[s] ?? s;
    get().updateDoc(docId, { content: outlineToMarkdown(tree, label) });
    get().toast('大纲树已写回文本视图', 'success');
  },
});
