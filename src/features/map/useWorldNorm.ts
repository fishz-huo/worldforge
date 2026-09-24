/**
 * 世界层的引用与「客户端坐标 ↔ 归一化坐标」换算
 * ==================================================================
 * 从 useCanvasGestures 抽出来单独放：第三轮里画布手势（边缘热区）与区域手势
 * （拖顶点、整体移动）都要用它，而两者互相不能依赖（谁先建都有环），于是把
 * 这一小块提成独立的 Hook，由 MapCanvas 建好再分别喂进去。
 *
 * 量的是**世界层**而不是外层画布：元素被 transform 之后 getBoundingClientRect
 * 给的就是变换后的位置与尺寸，于是缩放平移之后打点、拖标记、拖顶点依然准
 * （数据库里的坐标没变，变的只是屏幕上的换算）。
 */
import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { clampNorm } from './mapRender';

export interface WorldNorm {
  /** 世界层（宽高 = 底图像素、带 transform 的那一层）的引用 */
  worldRef: RefObject<HTMLDivElement>;
  /** 客户端坐标 → 归一化坐标（夹在 0~1） */
  toNorm: (clientX: number, clientY: number) => [number, number];
  /** 世界层此刻的屏幕矩形（命中判定要在屏幕像素里量距离） */
  worldRect: () => DOMRect | null;
}

export function useWorldNorm(): WorldNorm {
  const worldRef = useRef<HTMLDivElement>(null);

  const worldRect = useCallback(() => worldRef.current?.getBoundingClientRect() ?? null, []);

  const toNorm = useCallback((clientX: number, clientY: number): [number, number] => {
    const rect = worldRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [0.5, 0.5];
    return [
      clampNorm((clientX - rect.left) / rect.width),
      clampNorm((clientY - rect.top) / rect.height),
    ];
  }, []);

  return { worldRef, toNorm, worldRect };
}
