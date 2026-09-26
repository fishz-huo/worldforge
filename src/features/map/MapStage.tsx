/**
 * 地图舞台（工具条 + 画布）
 * ==================================================================
 * 从 MapModule 抽出来：那个文件要装 store 选择、视口与浮窗、选中状态与地形笔刷，
 * 再加上工具条与画布这一大块 JSX 会顶到「单文件 ≤200 行」。
 * 这里只是把模块算好的东西转发下去，**不含任何状态与逻辑**（props 的契约与
 * 说明见 mapStageApi.ts；工具栏与画布的细节看 MapToolbar / MapCanvas）。
 */
import { MapCanvas } from './MapCanvas';
import { MapToolbar } from './MapToolbar';
import type { MapStageProps } from './mapStageApi';

export function MapStage({
  map, mode, tool, brush, world, viewport, spots, panMode, altHeld, data, view, actions,
}: MapStageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MapToolbar
        map={map}
        pinCount={data.pinCount}
        regionCount={data.regions.length}
        terrainCount={data.terrainCount}
        mode={mode}
        onModeChange={actions.onModeChange}
      />

      <div className="min-h-0 flex-1 p-3">
        <MapCanvas
          map={map}
          viewMode={mode}
          panMode={panMode}
          altHeld={altHeld}
          pins={data.pins}
          regions={data.regions}
          terrain={data.terrain}
          tool={tool}
          world={world}
          viewport={viewport}
          spots={spots.bind}
          onNaturalSize={actions.onNaturalSize}
          selectedPinIds={view.selectedPinIds}
          selectedRegionIds={view.selectedRegionIds}
          selectedTerrainIds={view.selectedTerrainIds}
          hoveredPinId={view.hoveredPinId}
          hoveredRegionId={view.hoveredRegionId}
          regionMode={view.regionMode}
          resourceKey={view.resourceKey}
          showLabels={view.showLabels}
          onCanvasClick={actions.onCanvasClick}
          onPinMove={actions.onPinMove}
          onPinSelect={actions.onPinSelect}
          onRegionSelect={actions.onRegionSelect}
          onRegionPointMove={actions.onRegionPointMove}
          onRegionPoints={actions.onRegionPoints}
          onRegionRemovePoint={actions.onRegionRemovePoint}
          onRegionCreate={actions.onRegionCreate}
          terrainBrush={brush}
          onTerrainPlace={actions.onTerrainPlace}
          onTerrainSelect={actions.onTerrainSelect}
          onTerrainMove={actions.onTerrainMove}
          onTerrainResize={actions.onTerrainResize}
          onTerrainRotate={actions.onTerrainRotate}
          onMarqueeSelect={actions.onMarqueeSelect}
          onSelectionClear={actions.onSelectionClear}
          onToolExit={actions.onToolExit}
        />
      </div>
    </div>
  );
}
