/**
 * 区域工具：在空白处拖出一个矩形，松手即新建区域
 * ==================================================================
 * 用户 2026-09-26 的问题二：打点工具能新建标记，区域工具却只能选中 / 拖动已有的，
 * 两个按钮挨着、行为不对称。现在区域工具在**空白处**按住拖动 = 直接拉出一个
 * 矩形区域，松手即创建（与框选同一套骨架：按下 → 过 4px → 成框 → 松手提交）。
 *
 * 四条边界：
 *   1. 只在编辑模式 + 区域工具 + 非平移 + 没笔刷 + 按在空白 + 左键 + 无 Ctrl/⌘/Alt 时起手；
 *   2. 位移不过 4px 算点击，什么都不建（免得手抖留一个 0 大小的区域）；
 *   3. 矩形的边小于 MIN_DRAW_SIZE 也不建（那是一条线，不是区域）；
 *   4. Esc 撤框；成过框之后补的那次 click 要吃掉（否则刚选中的新区域会被取消选中）。
 *
 * 与框选的分工：框选只在「选择」工具下起手（见 mapMarquee.marqueeEligible）——
 * 一个工具的一种拖动只有一个含义，两个工具各拖各的，不会同时起手。
 * 按在已有区域内部仍是"拖动那块区域"：那种情况 onSpot 为真，这里直接不起手。
 */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MapTool } from '@/types';
import { MARQUEE_THRESHOLD, boxOf } from './mapMarquee';
import type { MarqueeBox } from './mapMarquee';
import { rectDrawable } from './mapRegionEdit';
import type { Point } from './mapRegionEdit';
import type { MapViewMode } from './mapRender';

interface Options {
  viewMode: MapViewMode;
  tool: MapTool;
  panMode: boolean;
  brushActive: boolean;
  /** 客户端坐标 → 归一化坐标（0~1 已夹好，所以新区域不会跑到地图外面） */
  toNorm: (clientX: number, clientY: number) => Point;
  /** 提交：两个对角点（归一化），由调用方建区域并选中 */
  onCreate: (a: Point, b: Point) => void;
}

export interface RegionDrawControls {
  /** 正在拖的矩形（画布内像素，MapRegionDrawLayer 按它摆）；没在拖就是 null */
  box: MarqueeBox | null;
  /** 按下（画布捕获阶段；onSpot = 这一下按在对象 / 顶点 / 手柄上） */
  press: (e: ReactPointerEvent<HTMLDivElement>, onSpot: boolean) => void;
  /** 移动：过阈值才成框并捕获指针 */
  track: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** 松手：成过框就建区域 */
  release: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** 指针取消 / Esc：撤框，不建 */
  cancel: () => void;
  /** 这一下 click 是不是"拉框建区域"的余波（是就吃掉） */
  consumeClick: () => boolean;
  /** 此刻是不是正在拉框（Esc 要让给这里，见 useMarquee 的 suppressEsc） */
  active: () => boolean;
}

/** 一次拖拽的现场：起点、画布原点、是否已经成框 */
interface Live {
  x0: number;
  y0: number;
  ox: number;
  oy: number;
  started: boolean;
}

export function useRegionDraw({
  viewMode, tool, panMode, brushActive, toNorm, onCreate,
}: Options): RegionDrawControls {
  const [box, setBox] = useState<MarqueeBox | null>(null);
  const liveRef = useRef<Live | null>(null);
  /** 这一次按下已经成过框：紧接着的 click 要吃掉 */
  const consumedRef = useRef(false);
  /** 提交回调从 ref 取最新（effect 只装一次） */
  const latest = useRef({ toNorm, onCreate });
  useEffect(() => {
    latest.current = { toNorm, onCreate };
  });

  const cancel = () => {
    liveRef.current = null;
    setBox(null);
  };

  const press = (e: ReactPointerEvent<HTMLDivElement>, onSpot: boolean) => {
    consumedRef.current = false;
    liveRef.current = null;
    if (viewMode !== 'edit' || tool !== 'region' || panMode || brushActive) return;
    if (onSpot || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) return;
    const rect = e.currentTarget.getBoundingClientRect();
    liveRef.current = { x0: e.clientX, y0: e.clientY, ox: rect.left, oy: rect.top, started: false };
  };

  const track = (e: ReactPointerEvent<HTMLDivElement>) => {
    const live = liveRef.current;
    if (!live) return;
    if (!live.started) {
      const moved = Math.abs(e.clientX - live.x0) >= MARQUEE_THRESHOLD
        || Math.abs(e.clientY - live.y0) >= MARQUEE_THRESHOLD;
      if (!moved) return; // 还没过阈值：这一下仍然是"点"，什么都不建
      live.started = true;
      // 捕获指针：拖过对象、甚至拖出画布，都还算"在拉这个矩形"
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setBox(boxOf(live.x0 - live.ox, live.y0 - live.oy, e.clientX - live.ox, e.clientY - live.oy));
  };

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    const live = liveRef.current;
    liveRef.current = null;
    setBox(null);
    if (!live || !live.started) return; // 没成框：这是普通点击
    consumedRef.current = true;
    const now = latest.current;
    const a = now.toNorm(live.x0, live.y0);
    const b = now.toNorm(e.clientX, e.clientY);
    if (!rectDrawable(a, b)) return; // 太扁 / 太小：不建，免得留下一根线
    now.onCreate(a, b);
  };

  const consumeClick = () => {
    if (!consumedRef.current) return false;
    consumedRef.current = false;
    return true;
  };

  /** Esc：撤掉正在拉的框（这时清空选中让给别处，见 useMarquee 的 suppressEsc） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (liveRef.current) cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { box, press, track, release, cancel, consumeClick, active: () => liveRef.current !== null };
}
