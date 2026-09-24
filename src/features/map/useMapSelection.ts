/**
 * 地图上的「选中谁」与悬停目标
 * ==================================================================
 * 从 MapModule 抽出来：第三批多了地形这一种可选中的东西，三个选中槽 + 悬停
 * 目标 + 点选后的"要不要展开检查器"一起写，那个文件就顶到 200 行以上了。
 *
 * 三条口径（第三轮定下、这里只是收口）：
 *   - **三种选中互斥**：选中一个就把另外两个清掉（不然会同时出现两张详情卡）；
 *   - 点选时立刻收起浮窗（spots.hide）：鼠标可能正好停在浮窗外；
 *   - 桌面**预览**模式下点选才主动展开检查器；触屏/窄屏不展开 ——
 *     那里弹的是底部抽屉，两个面板摞一起很乱。
 * 「清空选中」（点画布空白）也走这里：三种一起清，语义只有一个入口。
 */
import { useState } from 'react';
import type { MapSpots } from './MapSpotLayer';
import type { MapViewMode } from './mapRender';

type Slot = 'pin' | 'region' | 'terrain';

export interface MapSelection {
  selectedPinId: string | null;
  selectedRegionId: string | null;
  selectedTerrainId: string | null;
  /** 当前悬停（桌面）或点开（触屏）的目标，用于高亮 */
  hoveredPinId: string | null;
  hoveredRegionId: string | null;
  selectPin: (id: string | null) => void;
  selectRegion: (id: string | null) => void;
  selectTerrain: (id: string | null) => void;
  /** 三种一起清（点画布空白） */
  clear: () => void;
}

export function useMapSelection(
  spots: MapSpots,
  mode: MapViewMode,
  setInspectorOpen: (open: boolean) => void,
): MapSelection {
  const [pinId, setPinId] = useState<string | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [terrainId, setTerrainId] = useState<string | null>(null);

  /** 桌面预览下主动展开检查器（触屏/窄屏不展开，那里是底部抽屉） */
  const reveal = (id: string | null) => {
    if (!id || spots.coarse) return;
    if (mode === 'preview') setInspectorOpen(true);
  };

  const pick = (slot: Slot, id: string | null) => {
    setPinId(slot === 'pin' ? id : null);
    setRegionId(slot === 'region' ? id : null);
    setTerrainId(slot === 'terrain' ? id : null);
    spots.hide();
    reveal(id);
  };

  return {
    selectedPinId: pinId,
    selectedRegionId: regionId,
    selectedTerrainId: terrainId,
    hoveredPinId: spots.target?.kind === 'pin' ? spots.target.id : null,
    hoveredRegionId: spots.target?.kind === 'region' ? spots.target.id : null,
    selectPin: (id) => pick('pin', id),
    selectRegion: (id) => pick('region', id),
    selectTerrain: (id) => pick('terrain', id),
    clear: () => pick('pin', null),
  };
}
