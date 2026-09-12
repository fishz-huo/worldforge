/**
 * 地图检查器
 * ------------------------------------------------------------------
 * 选中标记 → PinEditor；选中区域 → RegionEditor；否则显示 MapOverview。
 */
import { Crosshair } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { InspectorPanel } from '@/components/layout/Panel';
import { useStore } from '@/store';
import { MapOverview } from './MapOverview';
import { PinEditor } from './PinEditor';
import { RegionEditor } from './RegionEditor';

export function MapInspector({
  selectedPinId,
  selectedRegionId,
}: {
  selectedPinId: string | null;
  selectedRegionId: string | null;
}) {
  const mapId = useStore((s) => s.selectedMapId);
  const pin = useStore((s) => s.pins.find((p) => p.id === selectedPinId));
  const region = useStore((s) => s.regions.find((r) => r.id === selectedRegionId));

  const title = pin ? '标记点' : region ? '区域 / 资源' : '地图概览';

  return (
    <InspectorPanel title={title}>
      {!mapId ? (
        <EmptyState icon={<Crosshair />} title="还没有地图" description="在左侧新建一张地图，然后开始打点。" />
      ) : pin ? (
        <PinEditor pinId={pin.id} />
      ) : region ? (
        <RegionEditor regionId={region.id} />
      ) : (
        <MapOverview mapId={mapId} />
      )}
    </InspectorPanel>
  );
}
