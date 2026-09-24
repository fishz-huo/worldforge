/**
 * 地图画布（视口 + 图层）
 * ------------------------------------------------------------------
 * 需求 2：可视化地图编辑器。第二批加入「像 Google 地图」的缩放与平移。
 *
 * 三层结构：
 *   视口窗口（外层 div：绑滚轮与拖拽平移，overflow-hidden）
 *     ├─ 世界层（宽高 = 底图原始像素，transform: translate + scale）
 *     │    ├─ 网格（仅编辑模式，画在底图之下）
 *     │    ├─ 底图 / 区域多边形（SVG）/ 标记点（见 MapLayers）
 *     └─ 区域覆盖层（屏幕空间：名称标签 + 顶点手柄，不随缩放变形）
 *
 * 指针与点击怎么解释在 useCanvasGestures（含归一化换算）；
 * 这个文件只负责结构与摆放。
 */
import { useMemo } from 'react';
import type { MapDef, MapPin, MapRegion, MapTool } from '@/types';
import { cn } from '@/lib/utils';
import { MapLayers } from './MapLayers';
import { MapRegionOverlay } from './MapRegionOverlay';
import { MapZoomControls } from './MapZoomControls';
import type { MapViewMode } from './mapRender';
import type { MapSpotBind } from './MapSpotLayer';
import type { Size } from './mapViewport';
import type { MapViewportApi } from './mapViewportApi';
import { useCanvasGestures } from './useCanvasGestures';

interface Props {
  map: MapDef;
  pins: MapPin[];
  regions: MapRegion[];
  tool: MapTool;
  /** 编辑 / 预览：预览下不落点、不写坐标、不显示网格与手柄 */
  viewMode: MapViewMode;
  /** 底图的世界尺寸（原始像素），视口按它换算 */
  world: Size;
  viewport: MapViewportApi;
  /** 悬停/点击浮窗的事件（见 MapSpotLayer） */
  spots: MapSpotBind;
  /** 把底图实测到的真实像素尺寸回报给模块 */
  onNaturalSize: (size: Size) => void;
  selectedPinId: string | null;
  selectedRegionId: string | null;
  hoveredPinId: string | null;
  hoveredRegionId: string | null;
  /** 区域显示模式：填充 / 仅轮廓 / 资源热度 */
  regionMode: 'fill' | 'outline' | 'resource';
  resourceKey: keyof NonNullable<MapRegion['resources']>;
  showLabels: boolean;
  onCanvasClick: (x: number, y: number) => void;
  onPinMove: (pinId: string, x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onRegionSelect: (regionId: string | null) => void;
  onRegionPointMove: (regionId: string, index: number, x: number, y: number) => void;
  className?: string;
}

export function MapCanvas({
  map, pins, regions, tool, viewMode, world, viewport, spots, onNaturalSize,
  selectedPinId, selectedRegionId, hoveredPinId, hoveredRegionId, regionMode, resourceKey,
  showLabels, onCanvasClick, onPinMove, onPinSelect, onRegionSelect, onRegionPointMove, className,
}: Props) {
  const hasBackground = Boolean(map.asset_id);
  const { worldRef, toNorm, startPinDrag, bind } = useCanvasGestures({
    viewMode, tool, viewport, onCanvasClick, onPinMove, onPinSelect, onRegionSelect,
  });

  /** 资源热度模式的归一化基准 */
  const maxResource = useMemo(
    () => Math.max(1, ...regions.map((r) => Number(r.resources?.[resourceKey] ?? 0))),
    [regions, resourceKey],
  );

  /** 光标：预览模式拖拽=平移，编辑模式按当前工具给 */
  const cursorClass =
    viewMode === 'preview'
      ? 'cursor-grab'
      : tool === 'pan'
        ? 'cursor-grab'
        : tool === 'pin'
          ? 'cursor-crosshair'
          : 'cursor-default';

  return (
    <div
      ref={viewport.boxRef}
      {...bind}
      className={cn(
        // 画布底色：浅暖灰（设计稿要求不要纯白）；暗色换一档更深的蓝灰
        'relative h-full w-full overflow-hidden rounded-lg border border-border',
        'bg-[#F5F4F0] dark:bg-[#121722]',
        cursorClass,
        className,
      )}
    >
      {/* 世界层：宽高 = 底图原始像素，靠 transform 平移缩放 */}
      <div ref={worldRef} data-wf-map-world style={viewport.worldStyle}>
        <MapLayers
          map={map}
          world={world}
          pins={pins}
          regions={regions}
          viewMode={viewMode}
          showLabels={showLabels}
          regionMode={regionMode}
          resourceKey={resourceKey}
          maxResource={maxResource}
          selectedPinId={selectedPinId}
          selectedRegionId={selectedRegionId}
          hoveredPinId={hoveredPinId}
          hoveredRegionId={hoveredRegionId}
          spots={spots}
          onNaturalSize={onNaturalSize}
          onPinSelect={onPinSelect}
          onPinDragStart={startPinDrag}
          onRegionSelect={onRegionSelect}
        />
      </div>

      {!hasBackground && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded bg-background/75 px-2 py-1 text-[11px] text-muted-foreground">
            未设置底图 —— 可直接摆放标记点，之后补图不会错位（可滚轮缩放、拖动平移）
          </span>
        </div>
      )}

      {/* 区域名称与顶点手柄画在屏幕空间：正圆、大小不随缩放变 */}
      <MapRegionOverlay
        regions={regions}
        selectedRegionId={selectedRegionId}
        hoveredRegionId={hoveredRegionId}
        viewMode={viewMode}
        showLabels={showLabels}
        toScreen={viewport.toScreenPixel}
        toNorm={toNorm}
        onPointMove={onRegionPointMove}
      />

      {/*
        缩放控件浮在画布右下角（像 Google 地图）。
        起初放在工具条上，实测 1280 宽、两栏都开着时工具条只有 608px 可用，
        加了这个胶囊会把整条挤成两行（57px），破坏「工具条底边与面板标题行齐平」
        的约定 —— 所以改成浮层。
        stopPropagation：拖这个胶囊不该带动整张地图平移。
      */}
      <div className="absolute bottom-3 right-3 z-30" onPointerDown={(e) => e.stopPropagation()}>
        <MapZoomControls
          percent={viewport.percent}
          onZoom={(factor) => viewport.zoomAtAnchor(factor)}
          onFit={viewport.fit}
        />
      </div>
    </div>
  );
}
