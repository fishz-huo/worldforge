/**
 * 插件事件总线
 * ------------------------------------------------------------------
 * 宿主在关键动作后广播事件（卡片保存、删除、切换世界观…），
 * 插件用 api.on(event, handler) 订阅。
 * 单独成文件是为了避免 store ↔ 插件注册表之间的循环依赖。
 */
import type { PluginEvent, PluginEventHandler } from '@/types';

/** event → handlers */
const listeners = new Map<PluginEvent, Set<PluginEventHandler>>();

/** 订阅事件（返回取消订阅函数） */
export function onPluginEvent(event: PluginEvent, handler: PluginEventHandler): () => void {
  const set = listeners.get(event) ?? new Set<PluginEventHandler>();
  set.add(handler);
  listeners.set(event, set);
  return () => {
    set.delete(handler);
    if (set.size === 0) listeners.delete(event);
  };
}

/** 广播事件（插件回调异常不应影响主流程） */
export function emitPluginEvent(event: PluginEvent, payload?: unknown): void {
  const set = listeners.get(event);
  if (!set) return;
  set.forEach((handler) => {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[worldforge] 插件事件 ${event} 处理失败`, err);
    }
  });
}

/** 清空某个插件的全部订阅（插件卸载时调用） */
export function clearPluginEvents(handlers: (() => void)[]): void {
  handlers.forEach((dispose) => dispose());
}
