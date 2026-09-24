/**
 * 世界层里的四个图层（网格 / 底图 / 区域多边形 / 标记点）
 * ==================================================================
 * 从 MapCanvas 抽出来：那个文件要装视口接线、坐标换算、点击语义与区域覆盖层，
 * 再加上四个图层的 JSX 会顶到「单文件 ≤200 行」那条自测（裁出来前是 211 行）。
 * 这里只做转发，不含任何逻辑 —— 各图层的细节看各自的文件。
 */
import type { MapDef, MapPin, MapRegion } from '@/types';
import { MapBackground } from './MapBackground';
import { MapGridLayer } from './MapGridLayer';
import { MapPinLayer } from './MapPinLayer';
import { MapRegionLayer } from './MapRegionLayer';
import type { MapSpotBind } from './MapSpotLayer';
import type { MapViewMode } from './mapRender';
import type { Size } from './mapViewport';

interface Props {
  map: MapDef;
  world: Size;
  pins: MapPin[];
  regions: MapRegion[];
  viewMode: MapViewMode;
  /** 平移态：图钉与区域都要让路（不选中、不拖动） */
  panMode: boolean;
  /** 编辑模式且工具允许：按住区域内部整体移动 */
  regionMovable: boolean;
  showLabels: boolean;
  regionMode: 'fill' | 'outline' | 'resource';
  resourceKey: keyof NonNullable<MapRegion['resources']>;
  maxResource: number;
  selectedPinId: string | null;
  selectedRegionId: string | null;
  hoveredPinId: string | null;
  hoveredRegionId: string | null;
  spots: MapSpotBind;
  onNaturalSize: (size: Size) => void;
  onPinSelect: (pinId: string | null) => void;
  onPinDragStart: (pinId: string) => void;
  onRegionSelect: (regionId: string | null) => void;
  onRegionDragStart: (region: MapRegion) => (e: React.PointerEvent) => void;
}

export function MapLayers({
  map, world, pins, regions, viewMode, panMode, regionMovable, showLabels, regionMode,
  resourceKey, maxResource, selectedPinId, selectedRegionId, hoveredPinId, hoveredRegionId,
  spots, onNaturalSize, onPinSelect, onPinDragStart, onRegionSelect, onRegionDragStart,
}: Props) {
  return (
    <>
      {/* 网格只在编辑模式出现，且画在底图之下：底图不透明时它自然被盖住 */}
      {viewMode === 'edit' && <MapGridLayer />}

      <MapBackground map={map} world={world} onNaturalSize={onNaturalSize} />

      <MapRegionLayer
        regions={regions}
        selectedRegionId={selectedRegionId}
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

      <MapPinLayer
        pins={pins}
        selectedPinId={selectedPinId}
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
