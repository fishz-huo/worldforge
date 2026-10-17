/**
 * 文稿标题的提交规则
 * ------------------------------------------------------------------
 * 顶部标题与侧栏标题共用这一条规则（两侧都走 DocTitleField）：
 * 提交前先 trim，空标题或与库里当前值相同就一个字都不写。
 * 返回 null ＝ 不写库、显示回退到当前值 —— 避免「清空成空串」和
 * 「反写旧值」这两类脏数据（2026-10-16 的标题不同步 P0 就是后者）。
 */
export function normalizeTitle(next: string, current: string): string | null {
  const trimmed = next.trim();
  if (!trimmed) return null;
  if (trimmed === current.trim()) return null;
  return trimmed;
}
