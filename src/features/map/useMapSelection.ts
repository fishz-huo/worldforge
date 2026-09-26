/**
 * 地图上的「选中谁」与悬停目标
 * ==================================================================
 * 从 MapModule 抽出来：第三批多了地形这一种可选中的东西，三个选中槽 + 悬停
 * 目标 + 点选后的"要不要展开检查器"一起写，那个文件就顶到 200 行以上了。
 *
 * 2026-09-26 扩成**选择集**（CAD 式框选一次能选中好几个）：
 *   - items 是唯一真相：0 个 = 没选中，1 个 = 单对象编辑器，≥2 = 多选面板；
 *   - 图层要的是"各自的 id 清单"（多选要一起高亮），由 items 派生，useMemo
 *     保证 items 不变时身份不变；
 *   - 点选一个对象 = 把选择集换成它自己，所以原来「三种选中互斥」的口径原样保留；
 *   - 框选提交走 selectMany：Shift 追加去重、否则整体替换（合并规则见 mapSelection）。
 *
 * 另外两条老口径不变：
 *   - 点选时立刻收起浮窗（spots.hide）：鼠标可能正好停在浮窗外；
 *   - 桌面**预览**模式下点选才主动展开检查器；触屏/窄屏不展开 ——
 *     那里弹的是底部抽屉，两个面板摞一起很乱。
 * 「清空选中」（点画布空白 / Esc）也走这里：语义只有一个入口。
 */
import { useMemo, useState } from 'react';
import { mergeItems } from './mapSelection';
import type { MapSelectionItem, MapSelectionKind } from './mapSelection';
import type { MapSpots } from './MapSpotLayer';
import type { MapViewMode } from './mapRender';

export interface MapSelection {
  /** 选中的对象（顺序＝框选命中的顺序；Shift 追加时原有的排在前） */
  items: MapSelectionItem[];
  /** 三种对象各自的 id 清单：图层高亮用（多个一起高亮） */
  selectedPinIds: string[];
  selectedRegionIds: string[];
  selectedTerrainIds: string[];
  /** 当前悬停（桌面）或点开（触屏）的目标，用于高亮 */
  hoveredPinId: string | null;
  hoveredRegionId: string | null;
  selectPin: (id: string | null) => void;
  selectRegion: (id: string | null) => void;
  selectTerrain: (id: string | null) => void;
  /** 框选提交：additive = 按住 Shift 追加 */
  selectMany: (items: MapSelectionItem[], additive: boolean) => void;
  /** 清空选中（点画布空白、Esc） */
  clear: () => void;
}

export function useMapSelection(
  spots: MapSpots,
  mode: MapViewMode,
  setInspectorOpen: (open: boolean) => void,
): MapSelection {
  const [items, setItems] = useState<MapSelectionItem[]>([]);

  /** 三种对象各自的 id（一次遍历分组，三层图层各取一份） */
  const grouped = useMemo(() => {
    const pick = (kind: MapSelectionKind) => items.filter((i) => i.kind === kind).map((i) => i.id);
    return { pin: pick('pin'), region: pick('region'), terrain: pick('terrain') };
  }, [items]);

  /** 桌面预览下主动展开检查器（触屏/窄屏不展开，那里是底部抽屉） */
  const reveal = (id: string | null) => {
    if (!id || spots.coarse) return;
    if (mode === 'preview') setInspectorOpen(true);
  };

  const pick = (kind: MapSelectionKind, id: string | null) => {
    setItems(id ? [{ kind, id }] : []);
    spots.hide();
    reveal(id);
  };

  /**
   * 框选提交。选中 ≥2 个时把检查器打开：多选面板是"选中了几个"的唯一反馈
   * （触屏/窄屏不自动弹抽屉，那会在拉框结束时糊一层浮层上来）。
   */
  const selectMany = (next: MapSelectionItem[], additive: boolean) => {
    const merged = mergeItems(items, next, additive);
    setItems(merged);
    spots.hide();
    if (!spots.coarse && merged.length >= 2) setInspectorOpen(true);
  };

  return {
    items,
    selectedPinIds: grouped.pin,
    selectedRegionIds: grouped.region,
    selectedTerrainIds: grouped.terrain,
    hoveredPinId: spots.target?.kind === 'pin' ? spots.target.id : null,
    hoveredRegionId: spots.target?.kind === 'region' ? spots.target.id : null,
    selectPin: (id) => pick('pin', id),
    selectRegion: (id) => pick('region', id),
    selectTerrain: (id) => pick('terrain', id),
    selectMany,
    clear: () => {
      setItems([]);
      spots.hide();
    },
  };
}
