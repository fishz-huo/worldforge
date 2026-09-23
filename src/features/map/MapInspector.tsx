/**
 * 地图检查器
 * ------------------------------------------------------------------
 * 选中标记 → PinEditor；选中区域 → RegionEditor；否则显示 MapOverview。
 * 预览模式（viewMode='preview'）一律换成只读信息卡：
 * 不给输入框、不给删除按钮，因此在这个模式下改不动任何数据。
 */
import { Crosshair } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { InspectorPanel } from '@/components/layout/Panel';
import { useStore } from '@/store';
import { PinReadonly, RegionReadonly } from './MapReadonlyInfo';
import { MapOverview } from './MapOverview';
import { PinEditor } from './PinEditor';
import { RegionEditor } from './RegionEditor';
import type { MapViewMode } from './mapRender';

export function MapInspector({
  selectedPinId,
  selectedRegionId,
  viewMode,
}: {
  selectedPinId: string | null;
  selectedRegionId: string | null;
  viewMode: MapViewMode;
}) {
  const mapId = useStore((s) => s.selectedMapId);
  const pin = useStore((s) => s.pins.find((p) => p.id === selectedPinId));
  const region = useStore((s) => s.regions.find((r) => r.id === selectedRegionId));

  const title = pin ? '标记点' : region ? '区域 / 资源' : '地图概览';
  const preview = viewMode === 'preview';

  return (
    // 检查器要是「白底表单」：外壳默认是 bg-card/40 半透明，这里传实底（twMerge 后者优先）
    <InspectorPanel title={preview ? `${title}（预览）` : title} className="bg-card">
      {!mapId ? (
        <EmptyState icon={<Crosshair />} title="还没有地图" description="在左侧新建一张地图，然后开始打点。" />
      ) : preview ? (
        pin ? (
          <PinReadonly pinId={pin.id} />
        ) : region ? (
          <RegionReadonly regionId={region.id} />
        ) : (
          <MapOverview mapId={mapId} viewMode={viewMode} />
        )
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
