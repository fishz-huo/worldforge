/**
 * 键盘快捷键 Hook
 * ------------------------------------------------------------------
 * 需求 6：操作逻辑符合人的习惯。统一在 AppShell 里注册：
 *   Ctrl/Cmd+K  命令面板
 *   Ctrl/Cmd+S  立即保存
 *   Ctrl/Cmd+\  专注模式
 *   Ctrl/Cmd+B  侧栏显隐
 *   1-9         切换模块（无修饰键，且焦点不在输入框时）
 *   Esc         关闭浮层
 */
import { useEffect } from 'react';

/** 判断事件是否来自输入控件（避免在打字时误触快捷键） */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

/** 快捷键映射：combo → handler；combo 形如 'mod+k'、'shift+1'、'escape' */
export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

/** 把键盘事件归一化成 combo 字符串 */
export function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('mod');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  parts.push(key);
  return parts.join('+');
}

/** 注册全局快捷键 */
export function useHotkeys(map: HotkeyMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const combo = comboOf(e);
      const fn = map[combo];
      if (!fn) return;
      // 无修饰键的单键快捷键在输入框内不触发
      if (!combo.includes('+') && isTypingTarget(e.target)) return;
      e.preventDefault();
      fn(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map, enabled]);
}
