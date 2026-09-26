/**
 * 地图检查器
 * ------------------------------------------------------------------
 * 选中地形符号 → TerrainEditor；选中标记 → PinEditor；选中区域 → RegionEditor；
 * 否则显示 MapOverview。预览模式（viewMode='preview'）一律换成只读信息卡：
 * 不给输入框、不给删除按钮，因此在这个模式下改不动任何数据。
 *
 * 地形与图钉是两个判断分支（selectedTerrainIds / selectedPinIds）：它们是同一张
 * 表的两种行，混在一个判断里会让"选中图钉"与"选中地形"到处都要再查一次 meta。
 * 2026-09-26 起选中状态是**选择集**（框选能选中好几个）：这里只看"正好 1 个"
 * 的情形，≥2 个交给多选面板（MapSelectionPanel）。
 */
import { Crosshair } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { InspectorPanel } from '@/components/layout/Panel';
import { useStore } from '@/store';
import { PinReadonly, RegionReadonly } from './MapReadonlyInfo';
import { MapOverview } from './MapOverview';
import { MapSelectionPanel } from './MapSelectionPanel';
import { PinEditor } from './PinEditor';
import { RegionEditor } from './RegionEditor';
import { TerrainEditor } from './TerrainEditor';
import { TerrainReadonly } from './TerrainReadonly';
import type { MapViewMode } from './mapRender';
import type { MapSelection } from './useMapSelection';

export function MapInspector({
  selection,
  viewMode,
  onDelete,
}: {
  selection: MapSelection;
  viewMode: MapViewMode;
  /** 批量删除的入口（多选面板的按钮；实现是 useMapDelete 的 request，与 Delete 键同一段） */
  onDelete: () => void;
}) {
  const mapId = useStore((s) => s.selectedMapId);
  /** 只有"正好选中 1 个"才走单对象编辑器：0 个是概览，多个是多选面板 */
  const single = selection.items.length === 1 ? selection.items[0] : null;
  const pinId = single?.kind === 'pin' ? single.id : null;
  const regionId = single?.kind === 'region' ? single.id : null;
  const terrainId = single?.kind === 'terrain' ? single.id : null;
  const pin = useStore((s) => s.pins.find((p) => p.id === pinId));
  const region = useStore((s) => s.regions.find((r) => r.id === regionId));
  const terrain = useStore((s) => s.pins.find((p) => p.id === terrainId));

  const title = terrain ? '地形符号' : pin ? '标记点' : region ? '区域 / 资源' : '地图概览';
  const preview = viewMode === 'preview';
  /** 框选到好几个：走多选面板（标题栏也换成"已选中 N 个对象"） */
  const multi = selection.items.length >= 2;

  return (
    // 检查器要是「白底表单」：外壳默认是 bg-card/40 半透明，这里传实底（twMerge 后者优先）
    <InspectorPanel
      title={multi ? `已选中 ${selection.items.length} 个对象` : preview ? `${title}（预览）` : title}
      className="bg-card"
    >
      {!mapId ? (
        <EmptyState icon={<Crosshair />} title="还没有地图" description="在左侧新建一张地图，然后开始打点。" />
      ) : multi ? (
        <MapSelectionPanel selection={selection} onDelete={onDelete} />
      ) : preview ? (
        terrain ? (
          <TerrainReadonly pinId={terrain.id} />
        ) : pin ? (
          <PinReadonly pinId={pin.id} />
        ) : region ? (
          <RegionReadonly regionId={region.id} />
        ) : (
          <MapOverview mapId={mapId} viewMode={viewMode} />
        )
      ) : terrain ? (
        <TerrainEditor pinId={terrain.id} />
      ) : pin ? (
        <PinEditor pinId={pin.id} />
      ) : region ? (
        <RegionEditor regionId={region.id} />
      ) : (
        <MapOverview mapId={mapId} viewMode={viewMode} />
      )}
    </InspectorPanel>
  );
}
