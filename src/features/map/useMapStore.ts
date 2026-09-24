/**
 * 地图模块（把模块要用的 store 数据与动作收在一处）
 * ==================================================================
 * 从 MapModule 抽出来：那个文件要装视口、浮窗、选中、地形笔刷与三段 JSX，
 * 十几行 `useStore(...)` 挤在里面会顶到「单文件 ≤200 行」。
 * 这里只声明"这个模块用到哪些数据与动作"，不含任何逻辑 —— 加字段时改一处即可，
 * 也比在组件里逐行读更清楚（读这份清单就知道模块动了 store 的哪些部分）。
 */
import { useStore } from '@/store';

export function useMapStore() {
  return {
    /* 数据 */
    maps: useStore((s) => s.maps),
    selectedMapId: useStore((s) => s.selectedMapId),
    pins: useStore((s) => s.pins),
    regions: useStore((s) => s.regions),
    assets: useStore((s) => s.assets),
    /* 动作 */
    selectMap: useStore((s) => s.selectMap),
    addPin: useStore((s) => s.addPin),
    updatePin: useStore((s) => s.updatePin),
    addRegion: useStore((s) => s.addRegion),
    updateRegion: useStore((s) => s.updateRegion),
    moveRegionPoint: useStore((s) => s.moveRegionPoint),
    removeRegionPoint: useStore((s) => s.removeRegionPoint),
    setInspectorOpen: useStore((s) => s.setInspectorOpen),
  };
}
