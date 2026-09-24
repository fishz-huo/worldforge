/**
 * 地图画布（视口 + 图层）
 * ------------------------------------------------------------------
 * 视口窗口 → 世界层（底图原始像素 + transform）→ 网格/底图/区域/标记；
 * 区域名称与顶点手柄另画在屏幕空间的覆盖层（不随缩放变形）。
 * 指针语义在 useCanvasGestures（含边缘热区）、归一化换算在 useWorldNorm、
 * 区域手势在 useRegionGestures；这个文件只负责结构与摆放。
 */
import { useCallback, useMemo } from 'react';
import type { MapDef, MapPin, MapRegion, MapTool } from '@/types';
import { cn } from '@/lib/utils';
import { MapFloat } from './MapFloat';
import { MapLayers } from './MapLayers';
import { MapRegionOverlay } from './MapRegionOverlay';
import { CURSOR_ADD_VERTEX, mapCursorClass } from './mapCursors';
import { insertOnEdge } from './mapRegionEdit';
import type { EdgeHit } from './mapRegionEdit';
import type { MapViewMode } from './mapRender';
import type { MapSpotBind } from './MapSpotLayer';
import type { Size } from './mapViewport';
import type { MapViewportApi } from './mapViewportApi';
import { useCanvasGestures } from './useCanvasGestures';
import { useRegionGestures } from './useRegionGestures';
import { useWorldNorm } from './useWorldNorm';

interface Props {
  map: MapDef;
  pins: MapPin[];
  regions: MapRegion[];
  tool: MapTool;
  /** 平移态（选中「平移」工具，或按住空格）：元素让路、光标变手 */
  panMode: boolean;
  /** 是否按住 Alt：顶点光标换「−」，点击即删 */
  altHeld: boolean;
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
  showLabels: boolean;  onCanvasClick: (x: number, y: number) => void;
  onPinMove: (pinId: string, x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onRegionSelect: (regionId: string | null) => void;
  onRegionPointMove: (regionId: string, index: number, x: number, y: number) => void;
  /** 整体移动区域 / 边缘加顶点：一次写回一串归一化顶点（一帧一次，不逐点写） */
  onRegionPoints: (regionId: string, points: [number, number][]) => void;
  /** 删一个顶点（store 自带「不足 3 个不删」的保护） */
  onRegionRemovePoint: (regionId: string, index: number) => void;
  className?: string;
}

export function MapCanvas({
  map, pins, regions, tool, panMode, altHeld, viewMode, world, viewport, spots, onNaturalSize,
  selectedPinId, selectedRegionId, hoveredPinId, hoveredRegionId, regionMode, resourceKey,
  showLabels, onCanvasClick, onPinMove, onPinSelect, onRegionSelect, onRegionPointMove,
  onRegionPoints, onRegionRemovePoint, className,
}: Props) {
  const hasBackground = Boolean(map.asset_id);
  const worldNorm = useWorldNorm();

  const selectedRegion = regions.find((r) => r.id === selectedRegionId) ?? null;
  /**
   * 区域整体移动的适用面：编辑模式 + 「选择 / 区域」工具 + 非平移态。
   * 「打点」工具下不动区域（想落点却把区域挪走最招人烦），平移态下让位给画布。
   */
  const regionMovable = viewMode === 'edit' && !panMode && (tool === 'select' || tool === 'region');
  const edgeEnabled = regionMovable && selectedRegion !== null;

  /** 边缘加顶点：纯数学，先建好喂给画布手势（热区判定与插入在同一处） */
  const insertAtEdge = useCallback(
    (region: MapRegion, hit: EdgeHit) => onRegionPoints(region.id, insertOnEdge(region.points, hit)),
    [onRegionPoints],
  );

  const { worldRef, toNorm, startPinDrag, edgeHot, bind } = useCanvasGestures({
    world: worldNorm,
    viewMode,
    tool,
    viewport,
    onCanvasClick,
    onPinMove,
    onPinSelect,
    onRegionSelect,
    edgeRegion: edgeEnabled ? selectedRegion : null,
    edgeEnabled,
    onEdgeInsert: insertAtEdge,
  });

  const regionGestures = useRegionGestures({
    toNorm,
    onPoints: onRegionPoints,
    onPointMove: onRegionPointMove,
    onRemovePoint: onRegionRemovePoint,
  });

  /** 资源热度模式的归一化基准 */
  const maxResource = useMemo(
    () => Math.max(1, ...regions.map((r) => Number(r.resources?.[resourceKey] ?? 0))),
    [regions, resourceKey],
  );

  /**
   * 光标：拖拽中 = grabbing；平移态 / 预览 = grab；打点 = crosshair。
   * 边缘热区改用自定义的「+」（见下 style），它比 class 优先。
   */
  const cursorClass = mapCursorClass({
    panning: viewport.panning,
    panMode,
    preview: viewMode === 'preview',
    tool,
  });

  return (
    <div
      ref={viewport.boxRef}
      /*
        指针事件逐个摊开而不是 `{...bind}`：mobile-lint 的「画布类组件必须有
        pointer/touch 处理」按源码文本判定，整包展开会让静态检查看不见它。
      */
      onPointerDownCapture={bind.onPointerDownCapture}
      onPointerDown={bind.onPointerDown}
      onPointerMove={bind.onPointerMove}
      onPointerUp={bind.onPointerUp}
      onPointerCancel={bind.onPointerCancel}
      onPointerLeave={bind.onPointerLeave}
      onClickCapture={bind.onClickCapture}
      onClick={bind.onClick}
      style={edgeHot && !viewport.panning ? { cursor: CURSOR_ADD_VERTEX } : undefined}
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
          panMode={panMode}
          regionMovable={regionMovable}
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
          onRegionDragStart={regionGestures.startMove}
        />
      </div>

      {/* 区域名称与顶点手柄画在屏幕空间：正圆、大小不随缩放变 */}
      <MapRegionOverlay
        regions={regions}
        selectedRegionId={selectedRegionId}
        hoveredRegionId={hoveredRegionId}
        viewMode={viewMode}
        showLabels={showLabels}
        panMode={panMode}
        altHeld={altHeld}
        toScreen={viewport.toScreenPixel}
        onVertexDown={(regionId, index) => regionGestures.vertexDown(regionId, index, altHeld)}
      />

      {/* 底部「未设置底图」提示与右下缩放胶囊：摆放与说明都在 MapFloat 里 */}
      <MapFloat
        showBackdropHint={!hasBackground}
        percent={viewport.percent}
        onZoom={(factor) => viewport.zoomAtAnchor(factor)}
        onFit={viewport.fit}
      />
    </div>
  );
}
