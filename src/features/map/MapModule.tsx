/**
 * 地图模块
 * ------------------------------------------------------------------
 * 需求 2：可视化地图编辑器。工具条（见 MapToolbar）+ 画布 + 侧栏 + 检查器；
 * 支持多地图（不同时期/分支）、标记点绑定卡片、区域资源与资源热度着色。
 * 视口（缩放/平移/适应屏幕）见 useMapViewport，浮窗见 useMapSpots：两者都是
 * **组件内状态**，不进 store、不落盘，换模块或刷新回到「适应屏幕」。
 */
import { useEffect, useMemo, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import type { MapTool, RegionResources } from '@/types';
import { useStore } from '@/store';
import { MapCanvas } from './MapCanvas';
import { MapInspector } from './MapInspector';
import { MapSidebar } from './MapSidebar';
import { useMapSpots } from './MapSpotLayer';
import { MapToolbar } from './MapToolbar';
import { resolveWorldSize } from './mapViewport';
import type { Size } from './mapViewport';
import { useMapKeys } from './useMapKeys';
import { useMapViewport } from './useMapViewport';
import type { MapViewMode } from './mapRender';

export function MapModule() {
  const maps = useStore((s) => s.maps);
  const selectedMapId = useStore((s) => s.selectedMapId);
  const selectMap = useStore((s) => s.selectMap);
  const pins = useStore((s) => s.pins);
  const regions = useStore((s) => s.regions);
  const assets = useStore((s) => s.assets);
  const addPin = useStore((s) => s.addPin);
  const addRegion = useStore((s) => s.addRegion);
  const updatePin = useStore((s) => s.updatePin);
  const moveRegionPoint = useStore((s) => s.moveRegionPoint);
  const updateRegion = useStore((s) => s.updateRegion);
  const removeRegionPoint = useStore((s) => s.removeRegionPoint);
  const setInspectorOpen = useStore((s) => s.setInspectorOpen);

  const [tool, setTool] = useState<MapTool>('select');
  /** 视图模式：只活在组件里（不动 store 与偏好），所以刷新后回到「编辑」 */
  const [mode, setMode] = useState<MapViewMode>('edit');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [regionMode, setRegionMode] = useState<'fill' | 'outline' | 'resource'>('fill');
  const [resourceKey, setResourceKey] = useState<keyof RegionResources>('population');
  /** <img> 实测到的底图像素尺寸（老底图没记 width/height 时用） */
  const [measured, setMeasured] = useState<Size | null>(null);

  // 没有选中地图时自动选第一张，避免打开模块是空白
  useEffect(() => {
    if (!selectedMapId && maps.length > 0) selectMap(maps[0].id);
  }, [selectedMapId, maps, selectMap]);

  /** 切模式时把工具复位成「选择」：否则从打点切预览再切回来，随手一点就多一个标记 */
  const changeMode = (next: MapViewMode) => {
    setMode(next);
    if (next === 'preview') setTool('select');
  };

  const map = maps.find((m) => m.id === selectedMapId) ?? null;
  /**
   * 底图仍然只有一张，就存在 maps.asset_id 上 —— 与 v0.1 完全一致。
   * v0.2 的「多层底图」既不参与坐标变换也不能分层管标记，已整体撤掉。
   */
  const mapPins = pins.filter((p) => p.map_id === map?.id);
  const mapRegions = regions.filter((r) => r.map_id === map?.id);

  /** 世界盒尺寸：资源表里记的像素 > <img> 实测 > 4:3 默认 */
  const asset = useMemo(() => assets.find((a) => a.id === map?.asset_id) ?? null, [assets, map?.asset_id]);
  const world = useMemo(() => resolveWorldSize(asset, measured), [asset, measured]);

  const spots = useMapSpots();
  /**
   * 平移的两个量（第三轮）：panLive = 左键能不能平移（预览/平移工具/空格）；
   * panMode = 元素要不要让路（平移工具/空格）。分开是因为「打点」工具下按
   * 空格也要能平移画布，而工具本身还是打点；中键不受它们影响（见 useMapViewport）。
   */
  const keys = useMapKeys();
  const panMode = tool === 'pan' || keys.space;
  const panLive = mode === 'preview' || panMode;
  const viewport = useMapViewport(world, map?.id ?? '', panLive, spots.hide);

  const hoveredPinId = spots.target?.kind === 'pin' ? spots.target.id : null;
  const hoveredRegionId = spots.target?.kind === 'region' ? spots.target.id : null;

  /**
   * 点选标记/区域时的「看得到详情」策略：桌面预览模式主动展开检查器；
   * 触屏/窄屏**不**展开（那里弹的是底部抽屉，两个面板摞一起很乱）。
   */
  const revealInspector = (id: string | null) => {
    if (!id || spots.coarse) return;
    if (mode === 'preview') setInspectorOpen(true);
  };

  const selectPin = (id: string | null) => {
    setSelectedPinId(id);
    setSelectedRegionId(null);
    spots.hide();
    revealInspector(id);
  };

  const selectRegion = (id: string | null) => {
    setSelectedRegionId(id);
    setSelectedPinId(null);
    spots.hide();
    revealInspector(id);
  };

  return (
    <ModuleLayout>
      <MapSidebar
        viewMode={mode}
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
            <MapToolbar
              map={map}
              pinCount={mapPins.length}
              regionCount={mapRegions.length}
              mode={mode}
              onModeChange={changeMode}
              tool={tool}
              onToolChange={setTool}
              onAddRegion={() => addRegion(map.id)}
            />

            <div className="min-h-0 flex-1 p-3">
              <MapCanvas
                map={map}
                viewMode={mode}
                panMode={panMode}
                altHeld={keys.alt}
                pins={mapPins}
                regions={mapRegions}
                tool={tool}
                world={world}
                viewport={viewport}
                spots={spots.bind}
                onNaturalSize={setMeasured}
                selectedPinId={selectedPinId}
                selectedRegionId={selectedRegionId}
                hoveredPinId={hoveredPinId}
                hoveredRegionId={hoveredRegionId}
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
                onPinSelect={selectPin}
                onRegionSelect={selectRegion}
                onRegionPointMove={(regionId, index, x, y) => moveRegionPoint(regionId, index, [x, y])}
                // 整体移动 / 加顶点：一次写回一串顶点（store 既有 action，不动 store）
                onRegionPoints={(regionId, points) => updateRegion(regionId, { points })}
                onRegionRemovePoint={(regionId, index) => removeRegionPoint(regionId, index)}
              />
            </div>
          </div>
        )}
      </ModuleBody>

      <MapInspector selectedPinId={selectedPinId} selectedRegionId={selectedRegionId} viewMode={mode} />
      {spots.overlay}
    </ModuleLayout>
  );
}
