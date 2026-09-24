/**
 * 画布交互语义（指针与点击怎么解释）
 * ==================================================================
 * 从 MapCanvas 抽出来：那个文件要摆世界层/覆盖层/缩放胶囊，再加上这堆事件
 * 处理会顶到「单文件 ≤200 行」。这里只负责「这一下鼠标动作是什么意思」：
 *
 *   - 换算：世界层的矩形 → 归一化 0~1。量的是**世界层**而不是外层画布，
 *     因为元素被 transform 之后 getBoundingClientRect 给的就是变换后的位置与
 *     尺寸，于是缩放平移之后打点、拖标记、拖顶点依然准（数据库里的坐标没变）。
 *   - 拖拽与点击的分界：位移超过 4px 算平移，否则算点击；平移结束后浏览器补的
 *     那次 click 要被吃掉，免得顺手取消选中或又落一个点。
 *   - 「这一次按下是不是按在图钉/区域上」：预览模式点图钉会展开检查器 → 画布
 *     变窄 → 世界重排 → 图钉从鼠标底下挪走，mouseup 落在别处、click 的目标变成
 *     画布本身，紧接着就会把刚选中的图钉取消掉（用户看到「点了图钉，检查器闪
 *     一下又回到概览」）。所以按下时先记一笔，那次 click 直接忽略。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { MapTool } from '@/types';
import { clampNorm } from './mapRender';
import type { MapViewMode } from './mapRender';
import type { MapViewportApi } from './mapViewportApi';

interface Options {
  viewMode: MapViewMode;
  tool: MapTool;
  viewport: MapViewportApi;
  onCanvasClick: (x: number, y: number) => void;
  onPinMove: (pinId: string, x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onRegionSelect: (regionId: string | null) => void;
}

export interface CanvasGestures {
  /** 世界层的引用：所有归一化换算都基于它 */
  worldRef: RefObject<HTMLDivElement>;
  /** 鼠标事件 → 归一化坐标（区域覆盖层拖顶点也要用） */
  toNorm: (clientX: number, clientY: number) => [number, number];
  /** 正在被拖动的标记（编辑模式才可能非空） */
  draggingPin: string | null;
  /** 图钉开始拖拽（MapPinLayer 的 onDragStart） */
  startPinDrag: (pinId: string) => void;
  /** 直接摊到画布外层 div 上的事件（onPointerDown / onClickCapture / …） */
  bind: {
    onPointerDownCapture: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerLeave: () => void;
    onClickCapture: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onClick: (e: ReactPointerEvent<HTMLDivElement>) => void;
  };
}

export function useCanvasGestures({
  viewMode, tool, viewport, onCanvasClick, onPinMove, onPinSelect, onRegionSelect,
}: Options): CanvasGestures {
  const worldRef = useRef<HTMLDivElement>(null);
  const [draggingPin, setDraggingPin] = useState<string | null>(null);
  const pressOnSpotRef = useRef(false);

  const toNorm = useCallback((clientX: number, clientY: number): [number, number] => {
    const rect = worldRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [0.5, 0.5];
    return [
      clampNorm((clientX - rect.left) / rect.width),
      clampNorm((clientY - rect.top) / rect.height),
    ];
  }, []);

  /**
   * 切到预览时清掉「正在被拖动」的标记。
   * 否则拖到一半切模式，松手前那几次 pointermove 还在往库里写坐标。
   */
  useEffect(() => {
    if (viewMode === 'preview') setDraggingPin(null);
  }, [viewMode]);

  const bind = {
    onPointerDownCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
      // 捕获阶段一定先跑，所以图钉/浮层控件在冒泡里 stopPropagation 也挡不住它
      viewport.notePress();
      pressOnSpotRef.current = Boolean(
        (e.target as HTMLElement).closest('[data-wf-map-pin],[data-wf-map-region]'),
      );
    },
    onPointerDown: viewport.bind.onPointerDown,
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      viewport.bind.onPointerMove(e);
      // 预览模式不写坐标（拖拽本就不该开始，这里再兜一层）
      if (viewMode !== 'edit' || !draggingPin) return;
      const [x, y] = toNorm(e.clientX, e.clientY);
      onPinMove(draggingPin, x, y);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      viewport.bind.onPointerUp(e);
      setDraggingPin(null);
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
      viewport.bind.onPointerCancel(e);
      setDraggingPin(null);
    },
    onPointerLeave: () => setDraggingPin(null),
    /** 平移结束后浏览器仍会补一个 click：捕获阶段吃掉它 */
    onClickCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!viewport.didDrag()) return;
      e.stopPropagation();
      e.preventDefault();
    },
    onClick: (e: ReactPointerEvent<HTMLDivElement>) => {
      // 这一下是按在图钉/区域上的：它们自己已经选中了，别因为重排把选中取消掉
      if (pressOnSpotRef.current) {
        pressOnSpotRef.current = false;
        return;
      }
      // 只有点在「底图/SVG」上才算落在图上：标记与区域内部会 stopPropagation
      const onSurface = (e.target as HTMLElement).dataset.surface === 'true';
      if (onSurface && viewMode === 'edit' && tool === 'pin') {
        const [x, y] = toNorm(e.clientX, e.clientY);
        onCanvasClick(x, y);
      } else {
        // 点空白（包括底图之外的留白）取消选中；预览模式只允许取消选中
        onPinSelect(null);
        onRegionSelect(null);
      }
    },
  };

  return { worldRef, toNorm, draggingPin, startPinDrag: setDraggingPin, bind };
}
