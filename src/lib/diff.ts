/**
 * 文本差异（LCS 行级 diff）
 * ------------------------------------------------------------------
 * 用于版本对比里展示「正文/摘要到底改了哪几行」。
 * 纯手写实现，不引入 diff 库；超大文本会退化为「公共前后缀 + 整块替换」，
 * 保证界面永远不会因为一篇十万字的长文卡死。
 */

/** 一行差异 */
export interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
}

/** 超过该行数时退化为粗粒度比较 */
const MAX_LINES = 2500;

/** 快速路径：剥掉公共前后缀，减少 DP 规模 */
function trimCommon(a: string[], b: string[]) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  return { start, endA, endB };
}

/** 行级差异 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const { start, endA, endB } = trimCommon(a, b);

  const head: DiffLine[] = a.slice(0, start).map((text) => ({ type: 'same' as const, text }));
  const tail: DiffLine[] = a.slice(endA).map((text) => ({ type: 'same' as const, text }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  // 退化路径：任一侧过长时不做 DP
  if (midA.length > MAX_LINES || midB.length > MAX_LINES) {
    return [
      ...head,
      ...midA.map((text) => ({ type: 'del' as const, text })),
      ...midB.map((text) => ({ type: 'add' as const, text })),
      ...tail,
    ];
  }

  // 经典 LCS 动态规划
  const n = midA.length;
  const m = midB.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const mid: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      mid.push({ type: 'same', text: midA[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      mid.push({ type: 'del', text: midA[i] });
      i += 1;
    } else {
      mid.push({ type: 'add', text: midB[j] });
      j += 1;
    }
  }
  while (i < n) {
    mid.push({ type: 'del', text: midA[i] });
    i += 1;
  }
  while (j < m) {
    mid.push({ type: 'add', text: midB[j] });
    j += 1;
  }

  return [...head, ...mid, ...tail];
}

/** 统计差异规模 */
export function diffStats(lines: DiffLine[]): { added: number; removed: number; same: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === 'add') acc.added += 1;
      else if (line.type === 'del') acc.removed += 1;
      else acc.same += 1;
      return acc;
    },
    { added: 0, removed: 0, same: 0 },
  );
}

/** 只保留有差异的片段（前后各留 context 行），用于折叠长文 */
export function collapseContext(lines: DiffLine[], context = 2): (DiffLine | { type: 'gap'; text: string })[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, i) => {
    if (line.type === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k += 1) keep[k] = true;
  });
  const out: (DiffLine | { type: 'gap'; text: string })[] = [];
  let gapCount = 0;
  lines.forEach((line, i) => {
    if (keep[i]) {
      if (gapCount > 0) {
        out.push({ type: 'gap', text: `… 省略 ${gapCount} 行相同内容 …` });
        gapCount = 0;
      }
      out.push(line);
    } else {
      gapCount += 1;
    }
  });
  if (gapCount > 0) out.push({ type: 'gap', text: `… 省略 ${gapCount} 行相同内容 …` });
  return out;
}
