/**
 * 世界层（底图原始像素的那一层 + 五个图层）
 * ==================================================================
 * 从 MapCanvas **纯搬家**搬出来的：那个文件要摆画布根节点、接指针语义、
 * 建视口，再加框选（2026-09-26），「世界层 div + 五个图层」这三十多行 JSX
 * 会把两个文件一起顶到「单文件 ≤200 行」那条自测。
 *
 * 这里一行逻辑都没有：把调用方算好的东西原样转发给 MapLayers。
 * `data-wf-map-world` 是坐标换算（useWorldNorm）与实测探针的锚点，**不能改名**。
 * 入参按 data / view / spots / actions 分四组，理由与 mapStageApi 一样 ——
 * 让调用点也短下来（否则 MapCanvas 里这一段光传参就有二十多行）。
 */
import type { CSSProperties, RefObject } from 'react';
import type { MapPin, MapRegion } from '@/types';
import { MapLayers } from './MapLayers';
import type { MapCanvasProps } from './mapStageApi';

type Canvas = MapCanvasProps;

export interface MapWorldLayerProps {
  /** 世界层本身的引用与行内样式（都由视口算好） */
  worldRef: RefObject<HTMLDivElement>;
  style: CSSProperties;
  /** 要画的数据 */
  data: Pick<Canvas, 'map' | 'world' | 'pins' | 'regions' | 'terrain'>;
  /** 视图与选中（regionMovable / brushActive / maxResource 是画布现算出来的） */
  view: Pick<Canvas, 'viewMode' | 'panMode' | 'showLabels' | 'regionMode' | 'resourceKey'
    | 'selectedPinIds' | 'selectedRegionIds' | 'selectedTerrainIds' | 'hoveredPinId' | 'hoveredRegionId'>
    & { regionMovable: boolean; brushActive: boolean; maxResource: number; regionClickThrough: boolean };
  /** 悬停/点击浮窗的三个上报（见 MapSpotLayer） */
  spots: Canvas['spots'];
  /** 图层要的动作：4 个来自 props，3 个是画布里的手势入口 */
  actions: Pick<Canvas, 'onNaturalSize' | 'onPinSelect' | 'onRegionSelect' | 'onTerrainSelect'> & {
    onPinDragStart: (pinId: string) => void;
    onRegionDragStart: (region: MapRegion) => (e: React.PointerEvent) => void;
    onTerrainDragStart: (pin: MapPin) => (e: React.PointerEvent) => void;
  };
}

export function MapWorldLayer({ worldRef, style, data, view, spots, actions }: MapWorldLayerProps) {
  return (
    <div ref={worldRef} data-wf-map-world style={style}>
      <MapLayers
        map={data.map}
        world={data.world}
        pins={data.pins}
        regions={data.regions}
        terrain={data.terrain}
        viewMode={view.viewMode}
        panMode={view.panMode}
        regionMovable={view.regionMovable}
        regionClickThrough={view.regionClickThrough}
        brushActive={view.brushActive}
        showLabels={view.showLabels}
        regionMode={view.regionMode}
        resourceKey={view.resourceKey}
        maxResource={view.maxResource}
        selectedPinIds={view.selectedPinIds}
        selectedRegionIds={view.selectedRegionIds}
        selectedTerrainIds={view.selectedTerrainIds}
        hoveredPinId={view.hoveredPinId}
        hoveredRegionId={view.hoveredRegionId}
        spots={spots}
        onNaturalSize={actions.onNaturalSize}
        onPinSelect={actions.onPinSelect}
        onPinDragStart={actions.onPinDragStart}
        onRegionSelect={actions.onRegionSelect}
        onRegionDragStart={actions.onRegionDragStart}
        onTerrainSelect={actions.onTerrainSelect}
        onTerrainDragStart={actions.onTerrainDragStart}
      />
    </div>
  );
}
