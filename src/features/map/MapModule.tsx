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
import { cn } from '@/lib/utils';
import type { MapTool, RegionResources } from '@/types';
import { useStore } from '@/store';
import { MapCanvas } from './MapCanvas';
import { MapInspector } from './MapInspector';
import { MapModeSwitch } from './MapModeSwitch';
import { MapSidebar } from './MapSidebar';
import type { MapViewMode } from './mapRender';

/**
 * 工具按钮的「当前选中」样式。
 * 三个按钮的**基底**统一成透明文字按钮（ghost + h-8），当前工具只用淡紫底表示状态，
 * 不再出现「一个是灰底、一个是描边」的混搭；hover 也一起压住，免得悬停时变色。
 */
const TOOL_ACTIVE = 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary';

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
  /**
   * 视图模式（编辑 / 预览）。只活在组件里：约束不允许动 store 与偏好文件，
   * 所以换模块或刷新都会回到「编辑」，不会留下"上次是预览"的隐状态。
   */
  const [mode, setMode] = useState<MapViewMode>('edit');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [regionMode, setRegionMode] = useState<'fill' | 'outline' | 'resource'>('fill');
  const [resourceKey, setResourceKey] = useState<keyof RegionResources>('population');

  // 没有选中地图时自动选第一张，避免打开模块是空白
  useEffect(() => {
    if (!selectedMapId && maps.length > 0) selectMap(maps[0].id);
  }, [selectedMapId, maps, selectMap]);

  /**
   * 切模式时把工具复位成「选择」。
   * 否则从「打点」切到预览、再切回编辑时，tool 还停在打点状态，
   * 随手点一下画布就多出一个标记 —— 用户看不出因果，只会觉得"它自己乱加东西"。
   */
  const changeMode = (next: MapViewMode) => {
    setMode(next);
    if (next === 'preview') setTool('select');
  };

  const map = maps.find((m) => m.id === selectedMapId) ?? null;
  /**
   * 底图仍然只有一张，就存在 maps.asset_id 上 —— 与 v0.1 完全一致。
   * v0.2 一度把它改成「多层底图」，但图层既不能分层管理标记、也不参与
   * 坐标变换，实际只是个更麻烦的贴图入口，已整体撤掉（见 migrate-columns.ts）。
   */
  const mapPins = pins.filter((p) => p.map_id === map?.id);
  const mapRegions = regions.filter((r) => r.map_id === map?.id);

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
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
              <span className="font-medium">{map.name}</span>
              {map.period && <span className="text-muted-foreground">· {map.period}</span>}
              <span className="text-muted-foreground">
                · 标记 {mapPins.length} · 区域 {mapRegions.length}
              </span>
              {/*
                工具条右组：所有控件统一 h-8（32px）+ items-center + gap-2。
                三个按钮基底都是透明文字按钮，只有「当前工具」带淡紫底；
                预览模式只留一个「选择」（对齐设计稿）。
              */}
              <div className="ml-auto flex items-center gap-2">
                {mode === 'edit' ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('h-8 gap-1', tool === 'pin' && TOOL_ACTIVE)}
                      onClick={() => setTool('pin')}
                    >
                      <Crosshair className="size-3.5" /> 打点模式
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('h-8 gap-1', tool === 'select' && TOOL_ACTIVE)}
                      onClick={() => setTool('select')}
                    >
                      <MousePointer2 className="size-3.5" /> 选择
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => addRegion(map.id)}>
                      新建区域
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setTool('select')}>
                    <MousePointer2 className="size-3.5" /> 选择
                  </Button>
                )}
                <span aria-hidden className="h-5 w-px bg-border" />
                <MapModeSwitch mode={mode} onChange={changeMode} />
              </div>
            </div>

            <div className="min-h-0 flex-1 p-3">
              <MapCanvas
                map={map}
                viewMode={mode}
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

      <MapInspector selectedPinId={selectedPinId} selectedRegionId={selectedRegionId} viewMode={mode} />
    </ModuleLayout>
  );
}
