/**
 * 地图模块
 * ------------------------------------------------------------------
 * 需求 2：可视化地图编辑器。工具条 + 画布（见 MapStage）+ 侧栏 + 检查器；
 * 支持多地图（不同时期/分支）、标记点绑定卡片、区域资源与资源热度着色，
 * 第三批起还有**地形符号**（复用 map_pins 的行，meta.kind='terrain'）。
 *
 * 视口（缩放/平移/适应屏幕）见 useMapViewport、浮窗见 useMapSpots：两者都是
 * **组件内状态**，不进 store、不落盘，换模块或刷新回到「适应屏幕」。
 * 这一层只负责「把谁接到谁身上」：数据与动作在 useMapStore，选中在 useMapSelection，
 * 地形笔刷在 useTerrainStage，笔刷的落点写入在 useMapTerrain。
 */
import { useEffect, useMemo, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import type { MapTool, RegionResources } from '@/types';
import { MapInspector } from './MapInspector';
import { MapSidebar } from './MapSidebar';
import { MapStage } from './MapStage';
import { useMapSpots } from './MapSpotLayer';
import { isTerrainPin } from './mapTerrain';
import { resolveWorldSize } from './mapViewport';
import type { Size } from './mapViewport';
import { useMapDelete } from './useMapDelete';
import { useMapKeys } from './useMapKeys';
import { useMapSelection } from './useMapSelection';
import { useMapStore } from './useMapStore';
import { useMapTerrain } from './useMapTerrain';
import { useMapViewport } from './useMapViewport';
import { useTerrainStage } from './useTerrainStage';
import type { MapViewMode } from './mapRender';

export function MapModule() {
  const {
    maps, selectedMapId, pins, regions, assets, selectMap, addPin, updatePin, addRegion,
    updateRegion, moveRegionPoint, removeRegionPoint, setInspectorOpen,
  } = useMapStore();
  const { place, patch } = useMapTerrain();

  const [tool, setTool] = useState<MapTool>('select');
  /** 视图模式：只活在组件里（不动 store 与偏好），所以刷新后回到「编辑」 */
  const [mode, setMode] = useState<MapViewMode>('edit');
  const [showLabels, setShowLabels] = useState(true);
  const [regionMode, setRegionMode] = useState<'fill' | 'outline' | 'resource'>('fill');
  const [resourceKey, setResourceKey] = useState<keyof RegionResources>('population');
  /** <img> 实测到的底图像素尺寸（老底图没记 width/height 时用） */
  const [measured, setMeasured] = useState<Size | null>(null);

  // 没有选中地图时自动选第一张，避免打开模块是空白
  useEffect(() => {
    if (!selectedMapId && maps.length > 0) selectMap(maps[0].id);
  }, [selectedMapId, maps, selectMap]);

  const map = maps.find((m) => m.id === selectedMapId) ?? null;
  /**
   * 底图仍然只有一张，就存在 maps.asset_id 上 —— 与 v0.1 完全一致。
   * v0.2 的「多层底图」既不参与坐标变换也不能分层管标记，已整体撤掉。
   */
  const mapAllPins = pins.filter((p) => p.map_id === map?.id);
  /** 地形也是 map_pins 的行：图钉计数、浮窗与卡片绑定都不能算上它们 */
  const mapTerrain = mapAllPins.filter(isTerrainPin);
  const mapPins = mapAllPins.filter((p) => !isTerrainPin(p));
  const mapRegions = regions.filter((r) => r.map_id === map?.id);

  /** 世界盒尺寸：资源表里记的像素 > <img> 实测 > 4:3 默认 */
  const world = useMemo(
    () => resolveWorldSize(assets.find((a) => a.id === map?.asset_id) ?? null, measured),
    [assets, map?.asset_id, measured],
  );

  const spots = useMapSpots();
  const sel = useMapSelection(spots, mode, setInspectorOpen);
  // Delete / Backspace：编辑模式下删掉选中的对象（规则与边界见 useMapDelete）
  useMapDelete(mode, sel);
  const terrain = useTerrainStage({
    map,
    pins: mapAllPins,
    place,
    patch,
    // 落下就选中它（另外两种选中由 useMapSelection 一并清掉）
    onPlaced: (id) => sel.selectTerrain(id),
  });

  /**
   * 平移的两个量（第三轮）：panLive = 左键能不能平移（预览/平移工具/空格）；
   * panMode = 元素要不要让路（平移工具/空格）。分开是因为「打点」工具下按
   * 空格也要能平移画布，而工具本身还是打点；中键不受它们影响（见 useMapViewport）。
   */
  const keys = useMapKeys();
  const panMode = tool === 'pan' || keys.space;
  const panLive = mode === 'preview' || panMode;
  const viewport = useMapViewport(world, map?.id ?? '', panLive, spots.hide);

  /** 换工具 = 放下笔刷（两个都"在用"会让左栏同时高亮两处，落点也容易打架） */
  const changeTool = (next: MapTool) => {
    setTool(next);
    terrain.clear();
  };

  /** 切模式时把工具复位成「选择」：否则从打点切预览再切回来，随手一点就多一个标记 */
  const changeMode = (next: MapViewMode) => {
    setMode(next);
    if (next === 'preview') {
      setTool('select');
      terrain.clear(); // 预览是只读的，笔刷必须放下
    }
  };

  return (
    <ModuleLayout>
      <MapSidebar
        viewMode={mode}
        tool={tool}
        setTool={changeTool}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        regionMode={regionMode}
        setRegionMode={setRegionMode}
        resourceKey={resourceKey}
        setResourceKey={setResourceKey}
        brush={terrain.brush}
        // 导出面板搬进左栏后要的两样（其余入参左栏自己有，见 MapSidebar 的 Props）
        world={world}
        viewport={viewport}
        // 选了笔刷就把工具切回「选择」（直接 setTool，别走 changeTool：那会顺手放下笔刷）
        setBrush={(symbol) => {
          terrain.pick(symbol);
          if (symbol) setTool('select');
        }}
      />

      <ModuleBody>
        {!map ? (
          <EmptyState
            icon={<MapIcon />}
            title="还没有地图"
            description="在左侧新建一张地图。一个世界观可以有多张地图，用来表现不同时期的疆域与资源变化。"
          />
        ) : (
          <MapStage
            map={map}
            mode={mode}
            tool={tool}
            brush={terrain.brush}
            world={world}
            viewport={viewport}
            spots={spots}
            panMode={panMode}
            altHeld={keys.alt}
            data={{ pins: mapPins, regions: mapRegions, terrain: mapTerrain, pinCount: mapPins.length, terrainCount: mapTerrain.length }}
            view={{
              selectedPinId: sel.selectedPinId,
              selectedRegionId: sel.selectedRegionId,
              selectedTerrainId: sel.selectedTerrainId,
              hoveredPinId: sel.hoveredPinId,
              hoveredRegionId: sel.hoveredRegionId,
              regionMode,
              resourceKey,
              showLabels,
            }}
            actions={{
              onModeChange: changeMode,
              onToolChange: changeTool,
              onAddRegion: () => addRegion(map.id),
              onNaturalSize: setMeasured,
              onCanvasClick: (x, y) => {
                const id = addPin(map.id, x, y, { label: `标记 ${mapPins.length + 1}`, color: '#ef4444' });
                sel.selectPin(id);
                changeTool('select');
              },
              onPinMove: (id, x, y) => updatePin(id, { x, y }),
              onPinSelect: sel.selectPin,
              onRegionSelect: sel.selectRegion,
              onRegionPointMove: (regionId, index, x, y) => moveRegionPoint(regionId, index, [x, y]),
              // 整体移动 / 加顶点：一次写回一串顶点（store 既有 action，不动 store）
              onRegionPoints: (regionId, points) => updateRegion(regionId, { points }),
              onRegionRemovePoint: (regionId, index) => removeRegionPoint(regionId, index),
              onTerrainPlace: terrain.placeAt,
              onTerrainSelect: sel.selectTerrain,
              onTerrainMove: (id, x, y) => updatePin(id, { x, y }),
              onTerrainResize: (id, size) => terrain.patchMeta(id, { size }),
              onTerrainRotate: (id, rotation) => terrain.patchMeta(id, { rotation }),
            }}
          />
        )}
      </ModuleBody>

      <MapInspector
        selectedPinId={sel.selectedPinId}
        selectedRegionId={sel.selectedRegionId}
        selectedTerrainId={sel.selectedTerrainId}
        viewMode={mode}
      />
      {spots.overlay}
    </ModuleLayout>
  );
}
