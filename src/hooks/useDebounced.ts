/**
 * 去抖 Hook
 * ------------------------------------------------------------------
 * 编辑器与搜索框都依赖它：输入时立即更新本地 state（保证光标不跳），
 * 去抖后才写库，避免每次按键都触发一次 SQLite UPDATE + 快照导出。
 */
import { useEffect, useRef, useState } from 'react';

/** 返回去抖后的值 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** 返回一个稳定的去抖回调（组件卸载时执行最后一次调用，避免丢数据） */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay = 300,
): (...args: A) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    },
    [],
  );

  return (...args: A) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      latest.current(...args);
    }, delay);
  };
}
