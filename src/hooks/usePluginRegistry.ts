/**
 * 插件注册表 Hook
 * ------------------------------------------------------------------
 * 用 useSyncExternalStore 订阅模块级注册表，
 * 插件注册 / 注销面板、卡片类型时界面能立即响应。
 */
import { useSyncExternalStore } from 'react';
import { getRegistry, subscribeRegistry, type RegistryState } from '@/lib/plugin/registry';

/** 订阅整个注册表 */
export function usePluginRegistry(): RegistryState {
  return useSyncExternalStore(subscribeRegistry, getRegistry, getRegistry);
}
