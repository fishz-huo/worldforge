/**
 * 编辑器语法着色的开关状态
 * ------------------------------------------------------------------
 * 它是纯界面状态（与世界观数据无关），所以走 localStorage，不进 store：
 *   · 不进 SQLite 快照 → 不占体积、不产生任何数据库写；
 *   · 开关切换不调用 onChange → docs.content 一个字节都不会变。
 *
 * 三处编辑器（写作 / 大纲 / 卡片详情）共用同一份状态：
 * 用 useSyncExternalStore 订阅，一处切换，其他两处同帧跟着变。
 * 默认**开启**；读到脏值（被手改、隐私模式下不可用）也按开启处理。
 */
import { useSyncExternalStore } from 'react';

const KEY = 'worldforge.editor.highlight';

/** 读取当前开关：只有明确写成 '0' 才算关闭 */
function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    /* 隐私模式 / 非浏览器环境：按默认开启 */
    return true;
  }
}

let enabled = read();
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** 供非组件代码读取（例如自测与调试） */
export function getEditorHighlight(): boolean {
  return enabled;
}

/** 写入开关并广播；写不动 localStorage 也不影响本次会话的显示 */
export function setEditorHighlight(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  try {
    localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    /* 忽略：本次会话仍然生效，只是下次打开回到默认 */
  }
  listeners.forEach((listener) => listener());
}

/** 工具条按钮用：一次点击即切换 */
export function toggleEditorHighlight(): void {
  setEditorHighlight(!enabled);
}

/** 订阅开关状态 */
export function useEditorHighlight(): boolean {
  return useSyncExternalStore(subscribe, getEditorHighlight, getEditorHighlight);
}
