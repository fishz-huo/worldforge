/**
 * 画布上「那一个」被选中的对象，以及由它派生的几个判定
 * ==================================================================
 * 纯搬家（2026-09-26）：边缘热区与顶点手柄只对**唯一**选中的区域 / 地形有意义，
 * 再加上「整体移动区域的适用面」与「在最近那条边上插一个顶点」，十几行逻辑写在
 * MapCanvas 里 —— 那个文件在装上框选、拉框建区域、图钉拖拽之后就没地方了。
 *
 * 这里只把 props 拼成画布要的几样东西，没有状态、没有副作用、没有新行为。
 */
import { useCallback } from 'react';
import type { MapPin, MapRegion, MapTool } from '@/types';
import { insertOnEdge } from './mapRegionEdit';
import type { EdgeHit } from './mapRegionEdit';
import type { MapViewMode } from './mapRender';

interface Options {
  tool: MapTool;
  viewMode: MapViewMode;
  panMode: boolean;
  /** 正在画地形（笔刷激活）：区域整体移动要让路 */
  brushActive: boolean;
  regions: MapRegion[];
  terrain: MapPin[];
  selectedRegionIds: string[];
  selectedTerrainIds: string[];
  /** 区域整体移动 / 加顶点：一次写回一串归一化顶点 */
  onRegionPoints: (regionId: string, points: [number, number][]) => void;
}

export interface MapTargets {
  /** 唯一选中的区域 / 地形（0 个或多个时都是 null） */
  selectedRegion: MapRegion | null;
  selectedTerrain: MapPin | null;
  /** 按住区域内部能不能整体拖动它 */
  regionMovable: boolean;
  /** 边缘热区是否启用（要有一个唯一选中的区域） */
  edgeEnabled: boolean;
  /** Ctrl/⌘ 点在热区上：在最近那条边加一个顶点 */
  insertAtEdge: (region: MapRegion, hit: EdgeHit) => void;
}

export function useMapTargets({
  tool, viewMode, panMode, brushActive, regions, terrain, selectedRegionIds,
  selectedTerrainIds, onRegionPoints,
}: Options): MapTargets {
  /** 「那一个」单选对象：边缘热区与顶点手柄只对唯一选中的区域 / 地形有意义 */
  const selectedRegion = selectedRegionIds.length === 1
    ? regions.find((r) => r.id === selectedRegionIds[0]) ?? null
    : null;
  const selectedTerrain = selectedTerrainIds.length === 1
    ? terrain.find((p) => p.id === selectedTerrainIds[0]) ?? null
    : null;
  /**
   * 区域整体移动的适用面：编辑模式 + 「选择 / 区域」工具 + 非平移态 + **没有笔刷**。
   * 打点工具下不动区域、平移态让位给画布；画地形时同样让位 —— 区域是"大目标"，
   * 笔刷激活时按在版图里想落符号却把整块区域拖走，是最难受的一种。
   */
  const regionMovable = viewMode === 'edit' && !panMode && !brushActive
    && (tool === 'select' || tool === 'region');
  const edgeEnabled = regionMovable && selectedRegion !== null;

  /** 边缘加顶点：纯数学，先建好喂给画布手势（热区判定与插入在同一处） */
  const insertAtEdge = useCallback(
    (region: MapRegion, hit: EdgeHit) => onRegionPoints(region.id, insertOnEdge(region.points, hit)),
    [onRegionPoints],
  );

  return { selectedRegion, selectedTerrain, regionMovable, edgeEnabled, insertAtEdge };
}
