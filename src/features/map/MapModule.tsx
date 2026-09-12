/**
 * 地图模块
 * ------------------------------------------------------------------
 * 需求 2：可视化地图编辑器。
 * 工具条 + 画布 + 侧栏 + 检查器；支持多地图（不同时期 / 分支）、
 * 标记点绑定卡片、区域资源（人口/农业/矿产…）与资源热度着色。
 */
import { useEffect, useState } from 'react';
import { Crosshair, Map as MapIcon, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import type { MapTool, RegionResources } from '@/types';
import { useStore } from '@/store';
import { MapCanvas } from './MapCanvas';
import { MapInspector } from './MapInspector';
import { MapSidebar } from './MapSidebar';

export function MapModule() {
  const maps = useStore((s) => s.maps);
  const selectedMapId = useStore((s) => s.selectedMapId);
  const selectMap = useStore((s) => s.selectMap);
  const pins = useStore((s) => s.pins);
  const regions = useStore((s) => s.regions);
  const addPin = useStore((s) => s.addPin);
  const addRegion = useStore((s) => s.addRegion);
  const updatePin = useStore((s) => s.updatePin);
  const moveRegionPoint = useStore((s) => s.moveRegionPoint);

  const [tool, setTool] = useState<MapTool>('select');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [regionMode, setRegionMode] = useState<'fill' | 'outline' | 'resource'>('fill');
  const [resourceKey, setResourceKey] = useState<keyof RegionResources>('population');

  // 没有选中地图时自动选第一张，避免打开模块是空白
  useEffect(() => {
    if (!selectedMapId && maps.length > 0) selectMap(maps[0].id);
  }, [selectedMapId, maps, selectMap]);

  const map = maps.find((m) => m.id === selectedMapId) ?? null;
  const mapPins = pins.filter((p) => p.map_id === map?.id);
  const mapRegions = regions.filter((r) => r.map_id === map?.id);

  return (
    <ModuleLayout>
      <MapSidebar
        tool={tool}
        setTool={setTool}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        regionMode={regionMode}
        setRegionMode={setRegionMode}
        resourceKey={resourceKey}
        setResourceKey={setResourceKey}
      />

      <ModuleBody>
        {!map ? (
          <EmptyState
            icon={<MapIcon />}
            title="还没有地图"
            description="在左侧新建一张地图。一个世界观可以有多张地图，用来表现不同时期的疆域与资源变化。"
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
              <span className="font-medium">{map.name}</span>
              {map.period && <span className="text-muted-foreground">· {map.period}</span>}
              <span className="text-muted-foreground">
                · 标记 {mapPins.length} · 区域 {mapRegions.length}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant={tool === 'pin' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1"
                  onClick={() => setTool('pin')}
                >
                  <Crosshair className="size-3.5" /> 打点模式
                </Button>
                <Button
                  variant={tool === 'select' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1"
                  onClick={() => setTool('select')}
                >
                  <MousePointer2 className="size-3.5" /> 选择
                </Button>
                <Button variant="outline" size="sm" onClick={() => addRegion(map.id)}>
                  新建区域
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-3">
              <MapCanvas
                map={map}
                pins={mapPins}
                regions={mapRegions}
                tool={tool}
                selectedPinId={selectedPinId}
                selectedRegionId={selectedRegionId}
                regionMode={regionMode}
                resourceKey={resourceKey}
                showLabels={showLabels}
                onCanvasClick={(x, y) => {
                  const id = addPin(map.id, x, y, {
                    label: `标记 ${mapPins.length + 1}`,
                    color: '#ef4444',
                  });
                  setSelectedPinId(id);
                  setSelectedRegionId(null);
                  setTool('select');
                }}
                onPinMove={(id, x, y) => updatePin(id, { x, y })}
                onPinSelect={(id) => {
                  setSelectedPinId(id);
                  setSelectedRegionId(null);
                }}
                onRegionSelect={(id) => {
                  setSelectedRegionId(id);
                  setSelectedPinId(null);
                }}
                onRegionPointMove={(regionId, index, x, y) => moveRegionPoint(regionId, index, [x, y])}
              />
            </div>
          </div>
        )}
      </ModuleBody>

      <MapInspector selectedPinId={selectedPinId} selectedRegionId={selectedRegionId} />
    </ModuleLayout>
  );
}
