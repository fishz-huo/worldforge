/**
 * 大纲双向同步的纯函数部分
 * ------------------------------------------------------------------
 * 四条不变式（I1~I4）在这里落地成「只算什么、不写什么」：
 *   I1 自动通道只写 outline_nodes，永不写 docs.content；
 *   I2 只新建行、只改 title / parent_id / order_index，
 *      绝不碰 status / card_id / summary 的既有值；
 *   I3 节点 → 文本只由用户显式改标题触发（R3），且先改行 title 再写文本；
 *   I4 落地前重算投影（见 useOutlineSync），不存在「拿着过期 diff 落地」的窗口。
 * 真正写库的动作都在 useOutlineSync.ts。
 */
import { outlineToCleanMarkdown } from '@/lib/outline-text';
import { buildOutlineTree, type Id, type OutlineNode } from '@/types';
import type { Projection } from './outlineProjection';

export interface NodeSyncPlan {
  /** 位置自动关联判定出来的改名：先落地，后续投影才能按标题自证命中 */
  renames: { rowId: Id; title: string }[];
  /** 文本里有、库里没有的标题：补行 */
  creates: { key: string; title: string; summary: string; parentKey: string | null; order: number }[];
  /** 结构与文本不一致的既有行：对齐父子与次序（真的不同才写） */
  aligns: { rowId: Id; parentKey: string | null; order: number }[];
}

export function planNodeSync(projection: Projection, rows: OutlineNode[]): NodeSyncPlan {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const renames: NodeSyncPlan['renames'] = [];
  const creates: NodeSyncPlan['creates'] = [];
  const aligns: NodeSyncPlan['aligns'] = [];

  projection.flat.forEach((node) => {
    if (!node.rowId) {
      creates.push({
        key: node.key,
        title: node.title,
        summary: node.summary,
        parentKey: node.parentKey,
        order: node.order_index,
      });
      return;
    }
    if (node.renameFrom && node.renameFrom !== node.title) {
      renames.push({ rowId: node.rowId, title: node.title });
    }
    const row = byId.get(node.rowId);
    if (!row) return;
    if (row.order_index !== node.order_index || row.parent_id !== node.parent_id) {
      aligns.push({ rowId: node.rowId, parentKey: node.parentKey, order: node.order_index });
    }
  });

  return { renames, creates, aligns };
}

/** 库里的大纲树 → 干净的 Markdown 文本（引导条「把树写进文本」用） */
export function outlineRowsToText(rows: OutlineNode[]): string {
  return outlineToCleanMarkdown(buildOutlineTree(rows));
}
