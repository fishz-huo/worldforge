/**
 * 地形符号的手势（移动 / 缩放 / 旋转 / 落点跟手）
 * ==================================================================
 * 与区域手势同一套路：window 级指针监听 —— 拖到画布外面（甚至窗口边缘）也要
 * 跟手，松手与取消都要摘干净（`trackPointer` 与 useRegionGestures 共用一份）。
 *
 * 每个动作都以**按下那一帧**的值当基准，不在上一帧结果上累加：累加会被 0~1
 * 的夹取一路吃掉（拖出去再拖回来，符号回不到原位）。
 *
 * 缩放按**半径比例**算（按下半径 → 当前半径），不是拿绝对距离去除以边长：
 * 手柄挂在框的角上，按下那一瞬的半径是"一半边长 × √2"，直接换算会让符号在
 * 第一次移动时先跳大一截。
 *
 * 缩放与旋转都不换算到归一化空间：指针距离与角度在客户端像素里算，
 * 中心点由世界层的屏幕矩形推出来（与世界层缩放无关）。
 */
import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MapPin } from '@/types';
import { clampNorm } from './mapRender';
import { angleFrom, readTerrain, scaleFromDrag } from './mapTerrain';
import { createFrameCommit } from './mapDragFrame';
import { DRAG_MIN, trackPointer } from './useRegionGestures';

interface Options {
  /** 客户端坐标 → 归一化坐标 */
  toNorm: (clientX: number, clientY: number) => [number, number];
  /** 世界层此刻的屏幕矩形（缩放与旋转要围着符号中心转） */
  worldRect: () => DOMRect | null;
  onMove: (pinId: string, x: number, y: number) => void;
  onResize: (pinId: string, size: number) => void;
  onRotate: (pinId: string, rotation: number) => void;
}

export interface TerrainGestures {
  /** 按住符号本体：移动（位移小于 4px 算点击，不写库） */
  startMove: (pin: MapPin) => (e: ReactPointerEvent) => void;
  /** 右下角方块：缩放 */
  startResize: (pin: MapPin) => (e: ReactPointerEvent) => void;
  /** 正上方圆点：旋转 */
  startRotate: (pin: MapPin) => (e: ReactPointerEvent) => void;
  /** 刚落下的符号立刻跟手（笔刷按下即落点，按住不放可以继续拖着摆位置） */
  follow: (pinId: string) => void;
}

export function useTerrainGestures({
  toNorm, worldRect, onMove, onResize, onRotate,
}: Options): TerrainGestures {
  /** 符号中心此刻的客户端坐标 */
  const centerOf = useCallback(
    (pin: MapPin): [number, number] | null => {
      const rect = worldRect();
      if (!rect || rect.width === 0) return null;
      return [rect.left + pin.x * rect.width, rect.top + pin.y * rect.height];
    },
    [worldRect],
  );

  const startMove = useCallback(
    (pin: MapPin) => (e: ReactPointerEvent) => {
      // 这一下归我们处理：别再冒泡给画布（否则会被当成"点空白"取消选中）
      e.stopPropagation();
      const [sx, sy] = toNorm(e.clientX, e.clientY);
      const { x: bx, y: by } = pin;
      const press = { x: e.clientX, y: e.clientY };
      const commit = createFrameCommit<[number, number]>(([x, y]) => {
        onMove(pin.id, clampNorm(bx + (x - sx)), clampNorm(by + (y - sy)));
      });
      let armed = false;
      trackPointer((ev) => {
        if (!armed) {
          if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) < DRAG_MIN) return;
          armed = true;
        }
        commit.push(toNorm(ev.clientX, ev.clientY));
      }, () => commit.flush());
    },
    [toNorm, onMove],
  );

  const startResize = useCallback(
    (pin: MapPin) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const meta = readTerrain(pin);
      const center = centerOf(pin);
      if (!meta || !center) return;
      const [cx, cy] = center;
      const r0 = Math.hypot(e.clientX - cx, e.clientY - cy);
      const commit = createFrameCommit<number>((r) => onResize(pin.id, scaleFromDrag(meta.size, r0, r)));
      trackPointer((ev) => commit.push(Math.hypot(ev.clientX - cx, ev.clientY - cy)), () => commit.flush());
    },
    [centerOf, onResize],
  );

  const startRotate = useCallback(
    (pin: MapPin) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const center = centerOf(pin);
      if (!center) return;
      const [cx, cy] = center;
      const commit = createFrameCommit<number>((a) => onRotate(pin.id, a));
      trackPointer((ev) => commit.push(angleFrom(cx, cy, ev.clientX, ev.clientY)), () => commit.flush());
    },
    [centerOf, onRotate],
  );

  const follow = useCallback(
    (pinId: string) => {
      const commit = createFrameCommit<[number, number]>(([x, y]) => onMove(pinId, x, y));
      trackPointer((ev) => commit.push(toNorm(ev.clientX, ev.clientY)), () => commit.flush());
    },
    [toNorm, onMove],
  );

  return { startMove, startResize, startRotate, follow };
}
