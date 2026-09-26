/**
 * 世界层里的五个图层（网格 / 底图 / 区域多边形 / 地形符号 / 标记点）
 * ==================================================================
 * 从 MapCanvas 抽出来：那个文件要装视口接线、坐标换算、点击语义与区域覆盖层，
 * 再加上这些图层的 JSX 会顶到「单文件 ≤200 行」那条自测（裁出来前是 211 行）。
 * 这里只做转发，不含任何逻辑 —— 各图层的细节看各自的文件。
 * 顺序（自下而上）：网格 → 底图 → 区域 → 地形 → 标记。地形压在区域之上、
 * 标记之下：地貌要在区划色块上看得见，而图钉永远是最上层（用户指定）。
 */
import type { MapDef, MapPin, MapRegion } from '@/types';
import { MapBackground } from './MapBackground';
import { MapGridLayer } from './MapGridLayer';
import { MapPinLayer } from './MapPinLayer';
import { MapRegionLayer } from './MapRegionLayer';
import { MapTerrainLayer } from './MapTerrainLayer';
import type { MapSpotBind } from './MapSpotLayer';
import type { MapViewMode } from './mapRender';
import type { Size } from './mapViewport';

interface Props {
  map: MapDef;
  world: Size;
  pins: MapPin[];
  regions: MapRegion[];
  /** 地形符号（也是 map_pins 的行，只是 meta.kind='terrain'） */
  terrain: MapPin[];
  viewMode: MapViewMode;
  /** 平移态：图钉与区域都要让路（不选中、不拖动） */
  panMode: boolean;
  /** 编辑模式且工具允许：按住区域内部整体移动 */
  regionMovable: boolean;
  /** 地形笔刷激活：地形符号让点击穿到画布上落新符号 */
  brushActive: boolean;
  showLabels: boolean;
  regionMode: 'fill' | 'outline' | 'resource';
  resourceKey: keyof NonNullable<MapRegion['resources']>;
  maxResource: number;
  selectedPinIds: string[];
  selectedRegionIds: string[];
  selectedTerrainIds: string[];
  hoveredPinId: string | null;
  hoveredRegionId: string | null;
  spots: MapSpotBind;
  onNaturalSize: (size: Size) => void;
  onPinSelect: (pinId: string | null) => void;
  onPinDragStart: (pinId: string) => void;
  onRegionSelect: (regionId: string | null) => void;
  onRegionDragStart: (region: MapRegion) => (e: React.PointerEvent) => void;
  onTerrainSelect: (pinId: string) => void;
  onTerrainDragStart: (pin: MapPin) => (e: React.PointerEvent) => void;
}

export function MapLayers({
  map, world, pins, regions, terrain, viewMode, panMode, regionMovable, brushActive, showLabels,
  regionMode, resourceKey, maxResource, selectedPinIds, selectedRegionIds, selectedTerrainIds,
  hoveredPinId, hoveredRegionId, spots, onNaturalSize, onPinSelect, onPinDragStart,
  onRegionSelect, onRegionDragStart, onTerrainSelect, onTerrainDragStart,
}: Props) {
  return (
    <>
      {/* 网格只在编辑模式出现，且画在底图之下：底图不透明时它自然被盖住 */}
      {viewMode === 'edit' && <MapGridLayer />}

      <MapBackground map={map} world={world} onNaturalSize={onNaturalSize} />

      <MapRegionLayer
        regions={regions}
        selectedRegionIds={selectedRegionIds}
        hoveredRegionId={hoveredRegionId}
        viewMode={viewMode}
        panMode={panMode}
        regionMovable={regionMovable}
        mode={regionMode}
        metric={String(resourceKey)}
        maxValue={maxResource}
        onSelect={onRegionSelect}
        onDragStart={onRegionDragStart}
        onSpotHover={spots.onSpotHover}
        onSpotLeave={spots.onSpotLeave}
        onSpotTap={spots.onSpotTap}
      />

      {/* 地形符号：随底图缩放（见 MapTerrainLayer 的说明） */}
      <MapTerrainLayer
        terrain={terrain}
        selectedTerrainIds={selectedTerrainIds}
        viewMode={viewMode}
        panMode={panMode}
        brushActive={brushActive}
        onSelect={onTerrainSelect}
        onDragStart={onTerrainDragStart}
      />

      <MapPinLayer
        pins={pins}
        selectedPinIds={selectedPinIds}
        hoveredPinId={hoveredPinId}
        viewMode={viewMode}
        panMode={panMode}
        showLabels={showLabels}
        onSelect={onPinSelect}
        onDragStart={onPinDragStart}
        onSpotHover={spots.onSpotHover}
        onSpotLeave={spots.onSpotLeave}
        onSpotTap={spots.onSpotTap}
      />
    </>
  );
}
