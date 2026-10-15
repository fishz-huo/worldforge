/**
 * 大纲同步的落地动作（碰 store 的那一层）
 * ------------------------------------------------------------------
 * 纯计算在 outlineProjection.ts / outlineSync.ts，这里只负责"把算出来的动作写进去"。
 * 单独一个文件（而不是塞进 useOutlineSync.ts）是为了让自测能在 Node 里直接 import ——
 * 那边没有 React 运行时。
 *
 * 只写 outline_nodes；唯一会写 docs.content 的是引导条的 writeTreeToText，
 * 而它是由用户点按钮显式触发的，不属于自动通道（I1）。
 */
import type { Id } from '@/types';
import { useStore } from '@/store';
import { projectOutline, type ProjectedNode, type Projection } from './outlineProjection';
import { outlineRowsToText, planNodeSync, planTitleWrite } from './outlineSync';

/** 文本停手多久之后才写库 */
export const SYNC_DELAY = 500;

/** 读当下状态重算投影 */
export function projectCurrentDoc(docId: string): Projection {
  const st = useStore.getState();
  const doc = st.docs.find((d) => d.id === docId);
  const rows = st.outlineNodes.filter((n) => n.doc_id === docId);
  return projectOutline(doc?.content ?? '', rows, docId);
}

/**
 * 落地一次同步。读的是「当下」的文本与行 —— 比版本号护栏更强，
 * 压根不存在"拿着过期 diff 落地"的窗口。返回实际写了几处，便于自测断言。
 */
export function applyNodeSync(docId: string): number {
  const st = useStore.getState();
  const doc = st.docs.find((d) => d.id === docId);
  if (!doc) return 0;
  const rows = st.outlineNodes.filter((n) => n.doc_id === docId);
  const projection = projectOutline(doc.content ?? '', rows, docId);
  const plan = planNodeSync(projection, rows);
  if (plan.renames.length + plan.creates.length + plan.aligns.length === 0) return 0;

  // 键 → 行 id：已匹配的先登记，新建的边建边登记（父节点一定先于子节点创建）
  const idByKey = new Map<string, Id>();
  projection.flat.forEach((n) => { if (n.rowId) idByKey.set(n.key, n.rowId); });
  const parentOf = (parentKey: string | null): Id | null =>
    parentKey ? idByKey.get(parentKey) ?? null : null;

  // 改名先落地：后面的重解析才能按标题自证命中（I3）
  plan.renames.forEach((r) => st.updateOutlineNode(r.rowId, { title: r.title }));
  plan.creates.forEach((c) => {
    const id = st.addOutlineNode(docId, parentOf(c.parentKey), c.title);
    idByKey.set(c.key, id);
    st.updateOutlineNode(id, { order_index: c.order, ...(c.summary ? { summary: c.summary } : {}) });
  });
  plan.aligns.forEach((a) => {
    st.updateOutlineNode(a.rowId, { parent_id: parentOf(a.parentKey), order_index: a.order });
  });

  return plan.renames.length + plan.creates.length + plan.aligns.length;
}

/**
 * 改「额外信息」之前先确保库里有行 —— 打字后 500ms 内还没建行时，
 * 用户其实已经能点到这个节点了。用 key + 标题双重确认，避免文本刚变过时改错行。
 */
export function ensureOutlineRow(docId: string, node: ProjectedNode): Id | null {
  if (node.rowId) return node.rowId;
  applyNodeSync(docId);
  const hit = projectCurrentDoc(docId).flat.find((n) => n.key === node.key);
  return hit && hit.title === node.title ? hit.rowId : null;
}

/** 引导条「把树写进文本」：用库里的树重写文本（只写标题层级，不带旧版徽章） */
export function writeTreeToText(docId: string): number {
  const st = useStore.getState();
  const rows = st.outlineNodes.filter((n) => n.doc_id === docId);
  if (rows.length === 0) return 0;
  st.updateDoc(docId, { content: outlineRowsToText(rows) });
  return rows.length;
}

/**
 * 用户显式改标题（R3-1）：先算好要写的新文本（I4 护栏在 planTitleWrite 里），
 * 再按 I3 「先改行、后写文本」落地 —— 这样紧随其后的去抖重解析会按标题自证命中，
 * 不会把这次改名误判成「新增标题 + 孤立行」。
 *
 * 返回 false = 护栏拦下了（这期间文本又被改过），此时一个字都没写。
 */
export function renameOutlineNode(docId: string, node: ProjectedNode, nextTitle: string): boolean {
  const st = useStore.getState();
  const doc = st.docs.find((d) => d.id === docId);
  if (!doc) return false;
  const planned = planTitleWrite(doc.content ?? '', node, nextTitle);
  if (!planned) return false;

  // I3：先改行（还没建行就先补一行），再写文本
  const rowId = ensureOutlineRow(docId, node);
  if (rowId) st.updateOutlineNode(rowId, { title: planned.title });
  st.updateDoc(docId, { content: planned.content });
  return true;
}
