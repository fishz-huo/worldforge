/**
 * 画布交互语义（指针与点击怎么解释）
 * ==================================================================
 * 从 MapCanvas 抽出来：那个文件要摆世界层/覆盖层/缩放胶囊，再加上这堆事件
 * 处理会顶到「单文件 ≤200 行」。这里只负责「这一下鼠标动作是什么意思」：
 *
 *   - 换算：客户端坐标 → 归一化 0~1。换算本身搬去了 useWorldNorm（区域手势
 *     也要用同一份基准），这里只借它量边缘热区。
 *   - 拖拽与点击的分界：位移超过 4px 算平移，否则算点击；平移结束后浏览器补的
 *     那次 click 要被吃掉，免得顺手取消选中或又落一个点。
 *   - 「这一次按下是不是按在图钉/区域/顶点上」：预览模式点图钉会展开检查器 →
 *     画布变窄 → 世界重排 → 图钉从鼠标底下挪走，mouseup 落在别处、click 的目标
 *     变成画布本身，紧接着就会把刚选中的图钉取消掉（用户看到「点了图钉，检查器
 *     闪一下又回到概览」）。顶点是第三轮补上的同类问题：Alt 点顶点会把它删掉、
 *     DOM 跟着重排，那次 click 同样得忽略。
 *   - 边缘热区（第三轮问题三）：编辑模式下选中区域时，光标离它任意一条边
 *     ≤ EDGE_TOLERANCE（屏幕像素）就算「热」，画布据此把光标换成「+」；此时
 *     Ctrl/⌘ + 左键点下去，就在**最近那条边**上加一个顶点。判定与插入在同一处，
 *     光标显示的位置与实际插入的位置不会打架。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MapRegion, MapTool } from '@/types';
import { nearestEdge, pointsToScreen } from './mapRegionEdit';
import type { EdgeHit } from './mapRegionEdit';
import type { MapViewMode } from './mapRender';
import type { MapViewportApi } from './mapViewportApi';
import type { WorldNorm } from './useWorldNorm';

/** 光标离边多近算「按在边上」（屏幕像素） */
export const EDGE_TOLERANCE = 8;

interface Options {
  world: WorldNorm;
  viewMode: MapViewMode;
  tool: MapTool;
  viewport: MapViewportApi;
  onCanvasClick: (x: number, y: number) => void;
  onPinMove: (pinId: string, x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onRegionSelect: (regionId: string | null) => void;
  /** 边缘热区针对的区域（编辑模式且已选中时才给） */
  edgeRegion: MapRegion | null;
  /** 边缘热区是否启用（编辑模式 + 非平移态 + 有选中区域） */
  edgeEnabled: boolean;
  /** Ctrl/⌘ + 左键点在热区上：在最近那条边加一个顶点 */
  onEdgeInsert: (region: MapRegion, hit: EdgeHit) => void;
}

export interface CanvasGestures {
  /** 世界层的引用：所有归一化换算都基于它 */
  worldRef: WorldNorm['worldRef'];
  /** 鼠标事件 → 归一化坐标（区域覆盖层拖顶点也要用） */
  toNorm: (clientX: number, clientY: number) => [number, number];
  /** 正在被拖动的标记（编辑模式才可能非空） */
  draggingPin: string | null;
  /** 图钉开始拖拽（MapPinLayer 的 onDragStart） */
  startPinDrag: (pinId: string) => void;
  /** 光标此刻是否落在选中区域的边缘热区上（画布据它换成「+」） */
  edgeHot: boolean;
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
  world, viewMode, tool, viewport, onCanvasClick, onPinMove, onPinSelect, onRegionSelect,
  edgeRegion, edgeEnabled, onEdgeInsert,
}: Options): CanvasGestures {
  const { worldRef, toNorm, worldRect } = world;
  const [draggingPin, setDraggingPin] = useState<string | null>(null);
  const [edgeHot, setEdgeHot] = useState(false);
  const pressOnSpotRef = useRef(false);
  /** 热区命中结果放 ref：鼠标每动一下都会重算，但只有「热/不热」翻转才重渲染 */
  const edgeHitRef = useRef<EdgeHit | null>(null);

  /**
   * 切到预览时清掉「正在被拖动」的标记。
   * 否则拖到一半切模式，松手前那几次 pointermove 还在往库里写坐标。
   */
  useEffect(() => {
    if (viewMode === 'preview') setDraggingPin(null);
  }, [viewMode]);

  /** 量一次边缘热区：只有热/不热翻转才 setState，避免跟着鼠标每帧重渲染 */
  const trackEdge = useCallback(
    (clientX: number, clientY: number) => {
      const rect = worldRect();
      const hit =
        edgeEnabled && edgeRegion && rect && rect.width > 0
          ? nearestEdge(
              pointsToScreen(edgeRegion.points, rect.width, rect.height),
              clientX - rect.left,
              clientY - rect.top,
              EDGE_TOLERANCE,
            )
          : null;
      edgeHitRef.current = hit;
      setEdgeHot(hit !== null);
    },
    [edgeEnabled, edgeRegion, worldRect],
  );

  const clearEdge = () => {
    edgeHitRef.current = null;
    setEdgeHot(false);
  };

  const bind = {
    onPointerDownCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
      // 捕获阶段一定先跑，所以图钉/顶点在冒泡里 stopPropagation 也挡不住它
      viewport.notePress();
      pressOnSpotRef.current = Boolean(
        (e.target as HTMLElement).closest('[data-wf-map-pin],[data-wf-map-region],[data-wf-map-vertex]'),
      );
    },
    onPointerDown: viewport.bind.onPointerDown,
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      viewport.bind.onPointerMove(e);
      trackEdge(e.clientX, e.clientY);
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
    onPointerLeave: () => {
      setDraggingPin(null);
      clearEdge();
    },
    /** 平移结束后浏览器仍会补一个 click：捕获阶段吃掉它 */
    onClickCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (viewport.didDrag()) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // Ctrl/⌘ + 左键点在边缘热区：加顶点。放在捕获阶段，先于区域自己的选中处理
      const hit = edgeHitRef.current;
      if (!hit || !edgeRegion || !(e.ctrlKey || e.metaKey)) return;
      e.stopPropagation();
      e.preventDefault();
      clearEdge();
      onEdgeInsert(edgeRegion, hit);
    },
    onClick: (e: ReactPointerEvent<HTMLDivElement>) => {
      // 这一下是按在图钉/区域/顶点上的：它们自己已经选中了，别因为重排把选中取消掉
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

  return { worldRef, toNorm, draggingPin, startPinDrag: setDraggingPin, edgeHot, bind };
}
