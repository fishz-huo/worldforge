/**
 * 地图画布（视口 + 图层 + 浮层）
 * ------------------------------------------------------------------
 * 视口窗口 → 世界层（底图原始像素 + transform）→ 网格 / 底图 / 区域 / 地形 / 标记；
 * 区域名称、顶点手柄与地形控制点另画在屏幕空间的覆盖层里（见 MapOverlays）。
 * 指针语义在 useCanvasGestures（含边缘热区与地形笔刷）、归一化换算在 useWorldNorm、
 * 区域手势在 useRegionGestures、地形手势在 useTerrainGestures；
 * 这个文件只负责结构与摆放。
 */
import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MapMarqueeLayer } from './MapMarqueeLayer';
import { MapOverlays } from './MapOverlays';
import { MapRegionDrawLayer } from './MapRegionDrawLayer';
import { MapWorldLayer } from './MapWorldLayer';
import { CURSOR_ADD_VERTEX, mapCursorClass } from './mapCursors';
import { TERRAIN_BASE_RATIO } from './mapTerrain';
import type { MapCanvasProps } from './mapStageApi';
import { useCanvasGestures } from './useCanvasGestures';
import { useMapTargets } from './useMapTargets';
import { useMarquee } from './useMarquee';
import { usePinDrag } from './usePinDrag';
import { useRegionDraw } from './useRegionDraw';
import { useRegionGestures } from './useRegionGestures';
import { useTerrainGestures } from './useTerrainGestures';
import { useWorldActions } from './useWorldActions';
import { useWorldNorm } from './useWorldNorm';

export function MapCanvas({
  map, pins, regions, terrain, tool, panMode, altHeld, viewMode, world, viewport, spots,
  onNaturalSize, selectedPinIds, selectedRegionIds, selectedTerrainIds, hoveredPinId,
  hoveredRegionId, regionMode, resourceKey, showLabels, onCanvasClick, onPinMove, onPinSelect,
  onRegionSelect, onRegionPointMove, onRegionPoints, onRegionRemovePoint, terrainBrush,
  onTerrainPlace, onTerrainSelect, onTerrainMove, onTerrainResize, onTerrainRotate,
  onMarqueeSelect, onSelectionClear, onRegionCreate, className,
}: MapCanvasProps) {
  const hasBackground = Boolean(map.asset_id);
  const worldNorm = useWorldNorm();
  /** 唯一选中的对象与由它派生的判定：见 useMapTargets（纯搬家） */
  const { selectedRegion, selectedTerrain, regionMovable, edgeEnabled, insertAtEdge } = useMapTargets({
    tool, viewMode, panMode, brushActive: terrainBrush !== null, regions, terrain,
    selectedRegionIds, selectedTerrainIds, onRegionPoints,
  });

  const regionGestures = useRegionGestures({
    toNorm: worldNorm.toNorm,
    onPoints: onRegionPoints,
    onPointMove: onRegionPointMove,
    onRemovePoint: onRegionRemovePoint,
  });

  const { follow, startMove, startResize, startRotate } = useTerrainGestures({
    toNorm: worldNorm.toNorm,
    worldRect: worldNorm.worldRect,
    onMove: onTerrainMove,
    onResize: onTerrainResize,
    onRotate: onTerrainRotate,
  });

  /** 笔刷落点：落完立刻让它跟手（按住不放可以继续拖着摆位置） */
  const placeTerrain = useCallback(
    (x: number, y: number) => {
      const id = onTerrainPlace(x, y);
      if (id) follow(id);
    },
    [onTerrainPlace, follow],
  );

  /** 区域工具：空白处拖出一个矩形就新建区域（先建它，好把 Esc 让给它） */
  const regionDraw = useRegionDraw({
    viewMode, tool, panMode, brushActive: terrainBrush !== null, toNorm: worldNorm.toNorm,
    onCreate: onRegionCreate,
  });

  /** 框选：起手条件、4px 阈值与"吃掉余波 click"都在 useMarquee 里 */
  const marquee = useMarquee({
    world: worldNorm, viewMode, tool, panMode, brushActive: terrainBrush !== null,
    pins, terrain, regions, onSelect: onMarqueeSelect, onClear: onSelectionClear,
    suppressEsc: regionDraw.active,
  });

  const pinDrag = usePinDrag({ toNorm: worldNorm.toNorm, onMove: onPinMove, enabled: viewMode === 'edit' });

  /** 世界层的动作总入口：落点在这里过一遍防重叠（见 useWorldActions） */
  const worldActions = useWorldActions({
    world: worldNorm, pins, onNaturalSize, onCanvasClick, onPinSelect, onPinDragStart: pinDrag.start,
    onRegionSelect, onRegionDragStart: regionGestures.startMove, onTerrainSelect,
    onTerrainDragStart: startMove,
  });
  /** 打点工具下区域内的点击要穿到画布上落点（问题三 F：区域里点半天落不下标记） */
  const regionClickThrough = viewMode === 'edit' && !panMode && tool === 'pin';

  const { edgeHot, bind } = useCanvasGestures({
    world: worldNorm,
    viewMode,
    tool,
    viewport,
    onCanvasClick: worldActions.onSurfaceClick,
    onPinSelect,
    onRegionSelect,
    onTerrainSelect,
    edgeRegion: edgeEnabled ? selectedRegion : null,
    edgeEnabled,
    onEdgeInsert: insertAtEdge,
    terrainBrush,
    panMode,
    onTerrainPlace: placeTerrain,
    marquee, regionDraw,
  });

  /** 资源热度模式的归一化基准 */
  const maxResource = useMemo(
    () => Math.max(1, ...regions.map((r) => Number(r.resources?.[resourceKey] ?? 0))),
    [regions, resourceKey],
  );

  /**
   * size=1 的地形符号在屏幕上的边长 = 底图宽的 6%。从视口的 toScreen 现算：
   * 两个归一化点的屏幕距离就是「世界宽 × 缩放」，不必再往外暴露一个 scale。
   */
  const terrainUnitPx = useMemo(
    () => (viewport.toScreenPixel(1, 0)[0] - viewport.toScreenPixel(0, 0)[0]) * TERRAIN_BASE_RATIO,
    [viewport.toScreenPixel],
  );

  /** 光标：拖拽中 = grabbing；平移态 / 预览 = grab；打点 = crosshair（边缘热区见下 style） */
  const cursorClass = mapCursorClass({
    panning: viewport.panning,
    panMode,
    preview: viewMode === 'preview',
    tool,
  });

  return (
    <div
      ref={viewport.boxRef}
      /* 指针事件逐个摊开而不是 `{...bind}`：mobile-lint 按源码文本判「画布类组件
         有没有 pointer/touch 处理」，整包展开会让它看不见。 */
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
        // touch-none：关掉原生触摸手势，否则触屏拖动会被判成滚动、发 pointercancel 掐掉
        'touch-none',
        'bg-[#F5F4F0] dark:bg-[#121722]',
        cursorClass,
        className,
      )}
    >
      {/* 世界层：宽高 = 底图原始像素，靠 transform 平移缩放（摆放见 MapWorldLayer） */}
      <MapWorldLayer
        worldRef={worldNorm.worldRef}
        style={viewport.worldStyle}
        spots={spots}
        data={{ map, world, pins, regions, terrain }}
        view={{
          viewMode, panMode, regionMovable, brushActive: terrainBrush !== null, showLabels,
          regionMode, resourceKey, maxResource, selectedPinIds, selectedRegionIds,
          selectedTerrainIds, hoveredPinId, hoveredRegionId, regionClickThrough,
        }}
        actions={worldActions.actions}
      />

      {/* 屏幕空间的浮层：区域名称与顶点手柄、地形控制点、缩放胶囊与底图提示 */}
      <MapOverlays
        regions={regions}
        selectedRegionId={selectedRegion?.id ?? null}
        hoveredRegionId={hoveredRegionId}
        viewMode={viewMode}
        showLabels={showLabels}
        panMode={panMode}
        altHeld={altHeld}
        toScreen={viewport.toScreenPixel}
        onVertexDown={(regionId, index) => regionGestures.vertexDown(regionId, index, altHeld)}
        terrainPin={selectedTerrain}
        unitPx={terrainUnitPx}
        onTerrainResizeStart={startResize}
        onTerrainRotateStart={startRotate}
        hasBackground={hasBackground}
        percent={viewport.percent}
        onZoom={(factor) => viewport.zoomAtAnchor(factor)}
        onFit={viewport.fit}
      />

      {/* 框选的虚框：拖到一半时跟着鼠标走（屏幕空间、不吃指针事件） */}
      <MapMarqueeLayer box={marquee.box} mode={marquee.mode} />

      {/* 区域工具的拉框：松手即按这个矩形建一个区域（同层、同样不吃指针事件） */}
      <MapRegionDrawLayer box={regionDraw.box} />
    </div>
  );
}
