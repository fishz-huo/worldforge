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
 *     Ctrl/⌘ + 左键点下去，就在**最近那条边**上加一个顶点。判定在 useEdgeHot，
 *     这里只决定按下之后做什么。
 *   - 地形笔刷（第三批）：独立状态（不给 MapTool 加 'terrain'，越界项 C 未批准）。
 *     按下那一瞬就落一个符号并让它跟手；松手补的那次 click 要吃掉，免得多选/取消。
 *   - 框选（2026-09-26）：判定与几何在 useMarquee，这里只把指针事件转给它，
 *     并在它成过框时吃掉补的那次 click（否则刚框好的选中会被立刻取消）。
 *   - 图钉拖拽（2026-09-26）搬去了 usePinDrag：它必须走 window 级监听，
 *     挂在画布元素上时指针一离开画布这次拖拽就永久结束（见那个文件的文件头）。
 *     这里因此不再持有「正在拖谁」的状态。
 *   - 区域拉框建区域（2026-09-26）：与框选同构，在 useRegionDraw。
 */
import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MapRegion, MapTool } from '@/types';
import type { TerrainSymbol } from './mapTerrain';
import type { EdgeHit } from './mapRegionEdit';
import type { MapViewMode } from './mapRender';
import type { MapViewportApi } from './mapViewportApi';
import type { MarqueeControls } from './useMarquee';
import type { RegionDrawControls } from './useRegionDraw';
import { useEdgeHot } from './useEdgeHot';
import type { WorldNorm } from './useWorldNorm';

interface Options {
  world: WorldNorm;
  viewMode: MapViewMode;
  tool: MapTool;
  viewport: MapViewportApi;
  onCanvasClick: (x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onRegionSelect: (regionId: string | null) => void;
  /** 点空白时三种选中一起清（图钉 / 区域 / 地形） */
  onTerrainSelect: (pinId: string | null) => void;
  /** 边缘热区针对的区域（编辑模式且已选中时才给） */
  edgeRegion: MapRegion | null;
  /** 边缘热区是否启用（编辑模式 + 非平移态 + 有选中区域） */
  edgeEnabled: boolean;
  /** Ctrl/⌘ + 左键点在热区上：在最近那条边加一个顶点 */
  onEdgeInsert: (region: MapRegion, hit: EdgeHit) => void;
  /** 地形笔刷（null = 没在画地形） */
  terrainBrush: TerrainSymbol | null;
  /** 平移态（平移工具或按住空格）：笔刷也要让路，否则按住空格拖动会顺手落一片符号 */
  panMode: boolean;
  /** 笔刷落点：调用方落一个符号并让它跟手 */
  onTerrainPlace: (x: number, y: number) => void;
  /** 框选（见 useMarquee）：按下/移动/松手/取消，以及"这一下已被框选吃掉" */
  marquee: MarqueeControls;
  /** 区域工具拉框建区域（见 useRegionDraw）：同一套指针事件，只是松手干什么不同 */
  regionDraw: RegionDrawControls;
}

export interface CanvasGestures {
  /** 世界层的引用：所有归一化换算都基于它 */
  worldRef: WorldNorm['worldRef'];
  /** 鼠标事件 → 归一化坐标（区域覆盖层拖顶点也要用） */
  toNorm: (clientX: number, clientY: number) => [number, number];
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
  world, viewMode, tool, viewport, onCanvasClick, onPinSelect, onRegionSelect,
  onTerrainSelect, edgeRegion, edgeEnabled, onEdgeInsert, terrainBrush, panMode, onTerrainPlace,
  marquee, regionDraw,
}: Options): CanvasGestures {
  const { worldRef, toNorm, worldRect } = world;
  const pressOnSpotRef = useRef(false);
  /** 这一次按下已经落了地形符号：紧接着的 click 要被吃掉（见文件头） */
  const brushPlacedRef = useRef(false);

  const edge = useEdgeHot({ worldRect, region: edgeRegion, enabled: edgeEnabled });

  const bind = {
    onPointerDownCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
      // 捕获阶段一定先跑，所以图钉/顶点在冒泡里 stopPropagation 也挡不住它
      viewport.notePress();
      const target = e.target as HTMLElement;
      // 顶点与地形手柄是"改形状"的入口，和对象本体分开算：Shift 在它们身上不起框
      const onHandle = Boolean(target.closest('[data-wf-map-vertex],[data-wf-map-terrain-handle]'));
      pressOnSpotRef.current = Boolean(target.closest(
        '[data-wf-map-pin],[data-wf-map-region],[data-wf-map-vertex],'
        + '[data-wf-map-terrain],[data-wf-map-terrain-handle]',
      ));
      // 起框：编辑模式 + 选择工具 + 空白（或 Shift+按在对象本体上）+ 没按别的修饰键
      marquee.press(e, onHandle ? 'handle'
        : (target.closest('[data-wf-map-pin],[data-wf-map-region],[data-wf-map-terrain]') ? 'body' : 'none'));
      // 区域工具下的空白拖动＝拉出一个新区域（两个工具互斥，不会同时起手）
      regionDraw.press(e, pressOnSpotRef.current);
    },
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      viewport.bind.onPointerDown(e);
      brushPlacedRef.current = false;
      // 地形笔刷：按下的那一瞬就落点（这样按住不放能继续拖着摆位置）。
      // 「打点」工具不受影响 —— 落点后那次 click 被吃掉，不会再落一个图钉。
      if (!terrainBrush || viewMode !== 'edit' || panMode) return;
      if (e.button !== 0 || pressOnSpotRef.current) return;
      brushPlacedRef.current = true;
      const [x, y] = toNorm(e.clientX, e.clientY);
      onTerrainPlace(x, y);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      viewport.bind.onPointerMove(e);
      edge.track(e.clientX, e.clientY);
      marquee.track(e);
      regionDraw.track(e);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      viewport.bind.onPointerUp(e);
      marquee.release(e);
      regionDraw.release(e);
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
      viewport.bind.onPointerCancel(e);
      marquee.cancel();
      regionDraw.cancel();
    },
    onPointerLeave: () => {
      edge.clear();
    },
    /** 平移结束后浏览器仍会补一个 click：捕获阶段吃掉它 */
    onClickCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (viewport.didDrag()) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // Ctrl/⌘ + 左键点在边缘热区：加顶点。放在捕获阶段，先于区域自己的选中处理
      const hit = edge.hit.current;
      if (!hit || !edgeRegion || !(e.ctrlKey || e.metaKey)) return;
      e.stopPropagation();
      e.preventDefault();
      edge.clear();
      onEdgeInsert(edgeRegion, hit);
    },
    onClick: (e: ReactPointerEvent<HTMLDivElement>) => {
      // 这一下是框选 / 拉框建区域的余波（松手后浏览器补的 click）：别当成"点空白"把选中取消掉
      if (marquee.consumeClick() || regionDraw.consumeClick()) return;
      // 这一下已经落了地形：别再当成"点空白"把刚落的符号取消选中
      if (brushPlacedRef.current) {
        brushPlacedRef.current = false;
        return;
      }
      const target = e.target as HTMLElement;
      const onSpot = pressOnSpotRef.current;
      pressOnSpotRef.current = false;
      // 点在「底图 / SVG」上才算落在图上：区域多边形也在那个 SVG 里，所以用 closest
      const onSurface = Boolean(target.closest('[data-surface="true"]'));
      // 按在区域多边形上、却不是按在图钉 / 地形 / 顶点 / 手柄上 —— 打点工具下这一下要落标记
      const regionOnly = Boolean(target.closest('[data-wf-map-region]'))
        && !target.closest('[data-wf-map-pin],[data-wf-map-terrain],[data-wf-map-vertex],[data-wf-map-terrain-handle]');
      if (onSurface && viewMode === 'edit' && tool === 'pin' && (!onSpot || regionOnly)) {
        const [x, y] = toNorm(e.clientX, e.clientY);
        onCanvasClick(x, y);
        return;
      }
      // 按在图钉 / 区域 / 顶点 / 地形上：它们自己已经选中了，别因为重排把选中取消掉
      if (onSpot) return;
      // 点空白（包括底图之外的留白）取消选中；预览模式只允许取消选中
      onPinSelect(null);
      onRegionSelect(null);
      onTerrainSelect(null);
    },
  };

  return { worldRef, toNorm, edgeHot: edge.hot, bind };
}
