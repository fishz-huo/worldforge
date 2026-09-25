/**
 * 选中对象后按 Delete / Backspace 直接删（只在编辑模式生效）
 * ==================================================================
 * 用户 2026-09-25 的规则：
 *   - 有选中才生效；删完把选中清空（检查器自动回「地图概览」、悬停浮窗收起）；
 *   - **预览模式一行都不装**（预览是只读的，按了不该有任何反应）；
 *   - 焦点在「打字的地方」时让路（isEditableTarget），只删文字不删对象；
 *   - 单个直接删（与检查器删除按钮行为一致），多个（将来框选）先 askConfirm；
 *   - 没有选中时不拦截：不 preventDefault，Backspace 该做什么还做什么。
 *
 * 监听挂在 window 上（与 useMapKeys 同一套路）：刚点过工具条 / 左栏也要能按。
 * 选中与删除实现都放 ref 里，effect 只依赖 mode —— 否则每次渲染都要重装监听
 * （拖画布、滚轮缩放时每帧都渲染）。
 */
import { useEffect, useRef } from 'react';
import { askConfirm } from '@/lib/confirm';
import { useStore } from '@/store';
import { isMapDeleteKey, mapDeleteConfirm, mapDeleteTargets } from './mapDelete';
import type { MapDeleteTarget } from './mapDelete';
import { isEditableTarget } from './mapPan';
import type { MapViewMode } from './mapRender';
import type { MapSelection } from './useMapSelection';

export function useMapDelete(mode: MapViewMode, selection: MapSelection): void {
  /** 两个删除动作直接从 store 取：MapModule 已 195 行，不再给它加转手；引用是稳定的 */
  const deletePin = useStore((s) => s.deletePin);
  const deleteRegion = useStore((s) => s.deleteRegion);

  /** 最新的选中与动作：effect 只装一次监听，处理时从这里读最新值 */
  const latest = useRef({ selection, deletePin, deleteRegion });
  useEffect(() => {
    latest.current = { selection, deletePin, deleteRegion };
  });

  useEffect(() => {
    if (mode !== 'edit') return;

    const remove = (targets: MapDeleteTarget[]) => {
      const now = latest.current;
      for (const t of targets) {
        if (t.kind === 'region') now.deleteRegion(t.id);
        else now.deletePin(t.id); // 标记与地形是同一张 map_pins 的两种行
      }
      now.selection.clear();
    };

    const onKey = (e: KeyboardEvent) => {
      if (!isMapDeleteKey(e.key)) return;
      // 这一下属于正在编辑的文字，不属于地图（输入框 / 文本域 / 可编辑区）
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;

      const { selectedPinId, selectedRegionId, selectedTerrainId } = latest.current.selection;
      const targets = mapDeleteTargets({
        pin: selectedPinId, region: selectedRegionId, terrain: selectedTerrainId,
      });
      if (targets.length === 0) return; // 没选中就不介入
      e.preventDefault(); // 命中才拦（顺带杜绝 Backspace 触发浏览器后退）
      if (targets.length === 1) {
        remove(targets);
        return;
      }
      // 三个槽互斥的今天走不到这一支；将来支持框选时按这里弹确认
      void askConfirm(mapDeleteConfirm(targets.length)).then((ok) => {
        if (ok) remove(targets);
      });
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);
}
