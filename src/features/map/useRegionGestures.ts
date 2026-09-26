/**
 * 区域手势（整体移动 / 拖顶点 / Alt 删顶点）
 * ==================================================================
 * 三件事都靠 **window 级**指针监听：鼠标拖到画布外面（甚至窗口边缘）也要跟手，
 * 松手与取消都要把监听摘掉，否则会留下幽灵监听。
 *
 * 整体移动的两个要点：
 *   - 以**按下那一帧的顶点**为基准算位移，不是每帧在上一次结果上累加：
 *     累加会被边界夹取一路吃掉（拖出去再拖回来，区域回不到原位）；
 *   - 位移由 clampShift 按包围盒夹取，形状一定不变形（见 mapRegionEdit）。
 *
 * 拖动阈值 4px 用**客户端像素**量：归一化空间各向异性，用它当阈值会横竖不一致。
 */
import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MapRegion } from '@/types';
import { clampShift, shiftPoints } from './mapRegionEdit';
import type { Point } from './mapRegionEdit';
import { createFrameCommit } from './mapDragFrame';

/** 位移小于它算「点」：免得单击时手抖 1px 就把区域挪走并写一次库 */
export const DRAG_MIN = 4;

/** 一次拖拽：全局监听指针，松手 / 取消都要摘干净（地形手势也用同一份） */
export function trackPointer(onMove: (e: PointerEvent) => void, onEnd?: () => void): void {
  const up = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    // 合帧写库的收尾（见 mapDragFrame）：最后一次移动可能还没到下一帧
    onEnd?.();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

interface Options {
  /** 客户端坐标 → 归一化坐标 */
  toNorm: (clientX: number, clientY: number) => Point;
  /** 整体移动写回：一次一串顶点（不是逐点写、不是逐帧追加） */
  onPoints: (regionId: string, points: Point[]) => void;
  /** 拖顶点改形状（既有行为） */
  onPointMove: (regionId: string, index: number, x: number, y: number) => void;
  /** 删一个顶点（store 自带「不足 3 个不删」的保护） */
  onRemovePoint: (regionId: string, index: number) => void;
}

export interface RegionGestures {
  /** 按住区域内部：整体平移 */
  startMove: (region: MapRegion) => (e: ReactPointerEvent) => void;
  /** 按住顶点：Alt 是删，否则进入改形状 */
  vertexDown: (regionId: string, index: number, altHeld: boolean) => (e: ReactPointerEvent) => void;
}

export function useRegionGestures({ toNorm, onPoints, onPointMove, onRemovePoint }: Options): RegionGestures {
  const startMove = useCallback(
    (region: MapRegion) => (e: ReactPointerEvent) => {
      // 这一下归我们处理：别再冒泡给画布（平移态下根本不会走到这里）
      e.stopPropagation();
      const [sx, sy] = toNorm(e.clientX, e.clientY);
      const base = region.points.map(([x, y]) => [x, y] as Point);
      const start = { x: e.clientX, y: e.clientY };
      /** 每帧最多写一次库（拖拽成本的大头，见 mapDragFrame） */
      const commit = createFrameCommit<Point>(([x, y]) => {
        const [dx, dy] = clampShift(base, x - sx, y - sy);
        onPoints(region.id, shiftPoints(base, dx, dy));
      });
      let armed = false;
      trackPointer((ev) => {
        if (!armed) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_MIN) return;
          armed = true;
        }
        commit.push(toNorm(ev.clientX, ev.clientY));
      }, () => commit.flush());
    },
    [toNorm, onPoints],
  );

  const vertexDown = useCallback(
    (regionId: string, index: number, altHeld: boolean) => (e: ReactPointerEvent) => {
      // 都要吃掉这一下：删完顶点后 DOM 会重排，跟着的那次 click 若落到画布上
      // 就会把刚选中的区域取消掉（用户看到"删一个顶点，选中也跟着没了"）
      e.stopPropagation();
      if (altHeld) {
        e.preventDefault();
        onRemovePoint(regionId, index);
        return;
      }
      trackPointer((ev) => {
        const [x, y] = toNorm(ev.clientX, ev.clientY);
        onPointMove(regionId, index, x, y);
      });
    },
    [toNorm, onPointMove, onRemovePoint],
  );

  return { startMove, vertexDown };
}
