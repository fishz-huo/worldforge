/**
 * 大纲投影
 * ------------------------------------------------------------------
 * 文本是唯一真相源：
 *   结构（层级、顺序）100% 来自 docs.content 里的 Markdown 标题；
 *   outline_nodes 只贡献额外信息（状态 / 摘要 / 卡片挂接）。
 * 匹配键 =「标题原文 + 同名标题里第几次出现」—— 这是两边唯一的联系。
 *
 * 本文件全是纯函数：不碰 store、不碰数据库、不写任何东西。
 */
import { scanOutlineHeadings } from '@/lib/outline-text';
import { buildOutlineTree, type Id, type OutlineNode, type OutlineTreeNode } from '@/types';

/** 还没建行的节点，id 用这个前缀占位（永远不要拿它去写库） */
export const PENDING_PREFIX = 'pending:';

export interface ProjectedNode extends OutlineTreeNode {
  /** 子节点（数组元素同样是投影节点） */
  children: ProjectedNode[];
  /** 库里那一行的 id；null = 文本里有这个标题、库里还没建行 */
  rowId: Id | null;
  /** 文本标题的稳定键（h0、h1…，按文本顺序） */
  key: string;
  /** 文本里的层级（1..6），depth 恒等于 level - 1 */
  level: number;
  /** 父节点的键；建行时用它解析 parent_id */
  parentKey: string | null;
  /** 位置自动关联判定出来的旧标题；非空表示要把这一行改名落地 */
  renameFrom: string | null;
  /** 文本里的位置，供跳转 / 光标反查使用 */
  line: number;
  lineStart: number;
  titleStart: number;
  /** 同名标题里第几次出现（0 基） */
  occurrence: number;
}

/** 统计：文本标题数 / 库行数 / 两边对上的行数 / 孤立的行（库里有文本没有）/ 缺行的标题 */
export interface ProjectionStats {
  headings: number;
  rows: number;
  matched: number;
  orphans: number;
  missing: number;
}

export interface Projection {
  roots: ProjectedNode[];
  /** 按文本顺序铺平（跳转、遍历、进度统计用） */
  flat: ProjectedNode[];
  /** 文本里没命中的行，原样带出来（不删、不写） */
  orphans: OutlineNode[];
  stats: ProjectionStats;
}

/** 匹配键：标题 + 同名标题里的第几次出现（治同名互相覆盖） */
export function matchKey(title: string, occurrence: number): string {
  return `${title}\u0000${occurrence}`;
}

/** 库里所有行按大纲树顺序铺平，并标出每行的深度 */
function flattenRows(rows: OutlineNode[]): { row: OutlineNode; depth: number }[] {
  const out: { row: OutlineNode; depth: number }[] = [];
  const walk = (list: OutlineTreeNode[], depth: number) => {
    list.forEach((node) => {
      out.push({ row: node, depth });
      walk(node.children, depth + 1);
    });
  };
  walk(buildOutlineTree(rows), 0);
  return out;
}

/**
 * 文本 + 库行 → 投影树。
 * 匹配不上的一律保守处理：行留库隐藏、标题按默认草稿显示，绝不张冠李戴。
 */
export function projectOutline(text: string, rows: OutlineNode[], docId: string): Projection {
  const headings = scanOutlineHeadings(text);
  const rowList = flattenRows(rows);

  // 库行也按「标题 + 第几次出现」编键，行顺序取大纲树顺序
  const rowByKey = new Map<string, { row: OutlineNode; depth: number }>();
  const rowSeen = new Map<string, number>();
  rowList.forEach((item) => {
    const occurrence = rowSeen.get(item.row.title) ?? 0;
    rowSeen.set(item.row.title, occurrence + 1);
    rowByKey.set(matchKey(item.row.title, occurrence), item);
  });

  // 1) 先按标题精确匹配
  const used = new Set<Id>();
  const matched = headings.map((h) => {
    const hit = rowByKey.get(matchKey(h.title, h.occurrence));
    if (!hit || used.has(hit.row.id)) return null;
    used.add(hit.row.id);
    return hit;
  });

  // 2) 剩下的做位置自动关联：只在「数量相等、层级逐项一致」时才认定是改名。
  //    有歧义就不猜（宁可显示默认草稿，也不要张冠李戴）。
  const freeIdx: number[] = [];
  matched.forEach((m, i) => { if (!m) freeIdx.push(i); });
  const freeRows = rowList.filter((item) => !used.has(item.row.id));
  let renamed = false;
  if (freeIdx.length > 0 && freeIdx.length === freeRows.length
    && freeIdx.every((hi, k) => headings[hi].level === freeRows[k].depth + 1)) {
    freeIdx.forEach((hi, k) => {
      matched[hi] = freeRows[k];
      used.add(freeRows[k].row.id);
    });
    renamed = true;
  }

  // 3) 按文本层级搭树（层级靠栈维护，和 headingsToNodes 同一套规则）
  const flat: ProjectedNode[] = [];
  const roots: ProjectedNode[] = [];
  const stack: ProjectedNode[] = [];
  const siblingCount = new Map<Id | 'root', number>();

  headings.forEach((h, i) => {
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    const parent = stack.length ? stack[stack.length - 1] : null;
    const row = matched[i]?.row ?? null;
    const key = `h${i}`;
    const group: Id | 'root' = parent ? parent.id : 'root';
    const order = siblingCount.get(group) ?? 0;
    siblingCount.set(group, order + 1);

    const node: ProjectedNode = {
      id: row?.id ?? `${PENDING_PREFIX}${key}`,
      doc_id: row?.doc_id ?? docId,
      parent_id: parent ? parent.id : null,
      order_index: order,
      title: h.title,
      summary: row ? row.summary : h.summary,
      status: row?.status ?? 'idea',
      card_id: row?.card_id ?? null,
      link_doc_id: row?.link_doc_id ?? null,
      meta: row?.meta ?? {},
      children: [],
      depth: h.level - 1,
      rowId: row?.id ?? null,
      key,
      level: h.level,
      parentKey: parent ? parent.key : null,
      renameFrom: renamed && row && row.title !== h.title ? row.title : null,
      line: h.line,
      lineStart: h.lineStart,
      titleStart: h.titleStart,
      occurrence: h.occurrence,
    };
    flat.push(node);
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  });

  const orphans = rowList.filter((item) => !used.has(item.row.id)).map((item) => item.row);
  const stats: ProjectionStats = {
    headings: headings.length,
    rows: rows.length,
    matched: flat.filter((n) => n.rowId !== null).length,
    orphans: orphans.length,
    missing: flat.filter((n) => n.rowId === null).length,
  };
  return { roots, flat, orphans, stats };
}

/**
 * 反查：字符偏移落在哪个标题下（= 光标当前所在节点）。
 * flat 按文本顺序排好，直接二分找最后一个 lineStart <= offset 的标题。
 */
export function headingAtOffset(flat: ProjectedNode[], offset: number): ProjectedNode | null {
  let lo = 0;
  let hi = flat.length - 1;
  let found: ProjectedNode | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (flat[mid].lineStart <= offset) {
      found = flat[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * 要不要出顶部引导条。
 * 只在「两边都有落空」时为真 —— 单边落空都有正常出口：
 *   文本新增了标题 → 镜像同步会自己把行补上；
 *   文本删掉了一行  → 那是用户正常编辑，行留库隐藏即可。
 * 都弹条的话，用户每删一行标题都要被问一次，反而变成噪音。
 */
export function needsGuide(stats: ProjectionStats): boolean {
  return stats.missing > 0 && stats.orphans > 0;
}
