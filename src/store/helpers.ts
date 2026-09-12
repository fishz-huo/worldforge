/**
 * Store 内部小工具
 * ------------------------------------------------------------------
 * 更新内存数组时保持不可变语义（替换引用而非就地修改），
 * 这样 React 的浅比较才能正确触发重渲染。
 */

/** 插入或替换（按 id 匹配） */
export function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

/** 批量插入或替换 */
export function upsertMany<T extends { id: string }>(list: T[], items: T[]): T[] {
  return items.reduce((acc, item) => upsert(acc, item), list);
}

/** 按 id 移除 */
export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

/** 按条件移除 */
export function removeWhere<T>(list: T[], predicate: (item: T) => boolean): T[] {
  return list.filter((item) => !predicate(item));
}

/** 生成一个不与现有项冲突的排序值（追加到末尾） */
export function nextOrder(list: { order_index: number }[]): number {
  return list.reduce((max, item) => Math.max(max, item.order_index ?? 0), 0) + 1;
}
