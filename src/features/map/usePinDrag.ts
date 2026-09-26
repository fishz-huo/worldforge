/**
 * 图钉拖拽（全局监听版）
 * ==================================================================
 * 2026-09-26 修：原来它挂在**画布元素**的 onPointerMove 上，而画布的
 * onPointerLeave 会把「正在拖谁」清掉 —— 指针一旦离开画布（快速甩动时几乎必然
 * 冲到左栏或工具条上），这次拖拽就永久结束，回到画布也不再恢复
 * （实测：终点离目标 177.3px，停在越出画布前那一帧）。
 * 现在与区域 / 地形同一套：window 级 pointermove，拖到画布外面甚至窗口边缘
 * 都还跟手；松手与取消都把监听摘干净（trackPointer 与 useRegionGestures 共用）。
 *
 * 坐标用**绝对**值（指针在哪、图钉中心就在哪），与原来一致：图钉是"点位"，
 * 不像区域那样要按包围盒夹取位移；越出 0~1 由 toNorm 收进边界。
 */
import { useCallback, useEffect, useRef } from 'react';
import { createFrameCommit } from './mapDragFrame';
import { trackPointer } from './useRegionGestures';

interface Options {
  /** 客户端坐标 → 归一化坐标（0~1 已在里面夹好） */
  toNorm: (clientX: number, clientY: number) => [number, number];
  onMove: (pinId: string, x: number, y: number) => void;
  /** 是否允许拖动（编辑模式）：预览下拖拽的每次移动都会写坐标 */
  enabled: boolean;
}

export interface PinDrag {
  /** 按住图钉开始拖（MapPinLayer 按下时直接调它，入参是图钉 id） */
  start: (pinId: string) => void;
}

export function usePinDrag({ toNorm, onMove, enabled }: Options): PinDrag {
  /** 拖动途中切模式（理论上做不到，但松手前那几次移动仍要拦住）：回调里读最新值 */
  const latest = useRef({ toNorm, onMove, enabled });
  useEffect(() => {
    latest.current = { toNorm, onMove, enabled };
  });

  const start = useCallback((pinId: string) => {
    /** 每帧最多写一次库（拖拽成本的大头，见 mapDragFrame） */
    const commit = createFrameCommit<[number, number]>(([x, y]) => latest.current.onMove(pinId, x, y));
    trackPointer((ev) => {
      const now = latest.current;
      if (!now.enabled) return;
      commit.push(now.toNorm(ev.clientX, ev.clientY));
    }, () => commit.flush());
  }, []);

  return { start };
}
