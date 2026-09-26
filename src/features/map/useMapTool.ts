/**
 * 地图工具（选择 / 打点 / 区域 / 平移）
 * ==================================================================
 * 从 MapModule 抽出来：2026-09-26 问题三「打点落一个点就切回选择」之后要装三条
 * 规则，写在那个文件里就没地方了 ——
 *   1. 落点后**保持打点**（连点可连续落），与地形笔刷一致；
 *   2. 同一个工具按钮**再点一次 = 回到「选择」**（打点常驻之后的退出方式之一）；
 *   3. 按 **Esc** 退出打点，回到「选择」。
 * 另外换工具要顺手放下地形笔刷：两个都"在用"会让左栏同时高亮两处，落点也容易打架。
 *
 * 工具本身仍是**组件内状态**：不进 store、不落盘，切模块或刷新回到「选择」。
 * 三条退出路径互不重复：再点按钮（pick）、Esc、切别的工具（pick 别的值）；
 * 切预览由调用方 reset（预览是只读的）。
 */
import { useCallback, useEffect, useState } from 'react';
import type { MapTool } from '@/types';

export interface MapToolState {
  tool: MapTool;
  /** 左栏工具按钮：点当前这个 = 收回「选择」 */
  pick: (next: MapTool) => void;
  /** 直接切到某个工具（选地形笔刷时把工具切回「选择」；不复位别的状态） */
  set: (next: MapTool) => void;
}

export function useMapTool(clearBrush: () => void): MapToolState {
  const [tool, setTool] = useState<MapTool>('select');

  const set = useCallback((next: MapTool) => setTool(next), []);

  const pick = useCallback((next: MapTool) => {
    setTool((cur) => (cur === next ? 'select' : next));
    clearBrush();
  }, [clearBrush]);

  /** Esc 退出打点。框选的 Esc（清空选中）与笔刷的 Esc（放下笔刷）各管一段，不抢 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setTool((cur) => (cur === 'pin' ? 'select' : cur));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { tool, pick, set };
}
