/**
 * 全局 Store
 * ------------------------------------------------------------------
 * 采用 zustand 的 slice 模式：每个业务域一个 slice，这里只做组装。
 * 使用方式：
 *   const cards = useStore((s) => s.cards);          // 订阅原始数组（引用稳定）
 *   const filtered = useMemo(() => filterCards(cards, opts), [cards, opts]);
 * 注意不要在 selector 里返回新数组/新对象，否则会触发无限重渲染。
 */
import { create } from 'zustand';
import { emitPluginEvent } from '@/lib/plugin/events';
import { createCardSlice } from './slices/cardSlice';
import { createDataSlice } from './slices/dataSlice';
import { createDocSlice } from './slices/docSlice';
import { createMapSlice } from './slices/mapSlice';
import { createOutlineSlice } from './slices/outlineSlice';
import { createPluginSlice } from './slices/pluginSlice';
import { createTagSlice } from './slices/tagSlice';
import { createTimelineSlice } from './slices/timelineSlice';
import { createUiSlice } from './slices/uiSlice';
import { createVersionSlice } from './slices/versionSlice';
import { createWorldSlice } from './slices/worldSlice';
import type { AppStore } from './types';

/** 全局唯一 store */
export const useStore = create<AppStore>()((...args) => ({
  ...createUiSlice(...args),
  ...createDataSlice(...args),
  ...createWorldSlice(...args),
  ...createCardSlice(...args),
  ...createTagSlice(...args),
  ...createMapSlice(...args),
  ...createTimelineSlice(...args),
  ...createDocSlice(...args),
  ...createOutlineSlice(...args),
  ...createVersionSlice(...args),
  ...createPluginSlice(...args),
}));

/** 非 React 环境读取 store（事件回调、工具函数里用） */
export const storeApi = {
  get: () => useStore.getState(),
  set: useStore.setState,
  subscribe: useStore.subscribe,
};

/** 应用启动流程：数据库 → 内置插件 → 激活插件 */
export async function startApp(): Promise<void> {
  const state = useStore.getState();
  await state.bootstrap();
  state.ensureBuiltinPlugins();
  await useStore.getState().activatePlugins();
  // 通知插件：应用已就绪
  emitPluginEvent('app:ready', { worldId: useStore.getState().currentWorldId });
}
