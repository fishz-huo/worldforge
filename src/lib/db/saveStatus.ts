/**
 * 保存状态（供状态栏展示）
 * ------------------------------------------------------------------
 * 本地优先软件最怕的是「不知道存没存」。
 * 单独的模块管理保存状态，让 sqlite.ts 专注 SQL 引擎本身。
 */

/** 保存状态机 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

let status: SaveStatus = 'idle';
let lastSavedAt = 0;
let lastError = '';

const listeners = new Set<(s: SaveStatus, at: number, err: string) => void>();

/** 订阅状态变化，返回取消订阅函数 */
export function onSaveStatus(cb: (s: SaveStatus, at: number, err: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 读取当前状态（组件首次渲染用） */
export function getSaveState(): { status: SaveStatus; lastSavedAt: number; lastError: string } {
  return { status, lastSavedAt, lastError };
}

/** 广播状态变化 */
export function emitStatus(next: SaveStatus, opts: { savedAt?: number; error?: string } = {}): void {
  status = next;
  if (opts.savedAt) lastSavedAt = opts.savedAt;
  if (opts.error) lastError = opts.error;
  listeners.forEach((cb) => cb(status, lastSavedAt, lastError));
}
