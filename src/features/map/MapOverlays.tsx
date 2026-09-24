/**
 * 画布上的屏幕空间浮层（区域名称与顶点手柄 / 地形控制点 / 缩放胶囊与底图提示）
 * ==================================================================
 * 从 MapCanvas 抽出来：那个文件要装视口接线、坐标换算、指针语义与图层转发，
 * 再加上这三块浮层就顶到「单文件 ≤200 行」了（第三批还要加地形控制点）。
 *
 * 为什么这三块必须在**屏幕空间**（画在世界层外面）：底图能放到 6 倍，
 * 画在世界层里的控件会跟着一起放大 —— 顶点手柄会变成巨圆、浮窗会变成巨块。
 * 它们的位置由 toScreen 从归一化坐标换算，尺寸是纯像素，所以天然恒定。
 */
import type { MapPin, MapRegion } from '@/types';
import { MapFloat } from './MapFloat';
import { MapRegionOverlay } from './MapRegionOverlay';
import { MapTerrainOverlay } from './MapTerrainOverlay';
import type { MapViewMode } from './mapRender';

interface Props {
  regions: MapRegion[];
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  viewMode: MapViewMode;
  showLabels: boolean;
  /** 平移态：手柄让路给画布 */
  panMode: boolean;
  /** 按住 Alt：区域顶点光标换「−」，点击即删 */
  altHeld: boolean;
  /** 归一化坐标 → 视口窗口内的像素位置 */
  toScreen: (nx: number, ny: number) => [number, number];
  onVertexDown: (regionId: string, index: number) => (e: React.PointerEvent) => void;
  /** 选中的地形符号（没选中给 null）：控制点只在编辑模式出现 */
  terrainPin: MapPin | null;
  /** size=1 时地形符号在屏幕上的边长（底图宽的 6%） */
  unitPx: number;
  onTerrainResizeStart: (pin: MapPin) => (e: React.PointerEvent) => void;
  onTerrainRotateStart: (pin: MapPin) => (e: React.PointerEvent) => void;
  /** 还没有底图：给一句提示 */
  hasBackground: boolean;
  percent: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
}

export function MapOverlays({
  regions, selectedRegionId, hoveredRegionId, viewMode, showLabels, panMode, altHeld, toScreen,
  onVertexDown, terrainPin, unitPx, onTerrainResizeStart, onTerrainRotateStart,
  hasBackground, percent, onZoom, onFit,
}: Props) {
  return (
    <>
      {/* 区域名称与顶点手柄：画在屏幕空间，正圆、大小不随缩放变 */}
      <MapRegionOverlay
        regions={regions}
        selectedRegionId={selectedRegionId}
        hoveredRegionId={hoveredRegionId}
        viewMode={viewMode}
        showLabels={showLabels}
        panMode={panMode}
        altHeld={altHeld}
        toScreen={toScreen}
        onVertexDown={onVertexDown}
      />

      {/* 地形控制点：同样画在屏幕空间（框本身在世界层里，随底图缩放） */}
      <MapTerrainOverlay
        pin={terrainPin}
        viewMode={viewMode}
        panMode={panMode}
        toScreen={toScreen}
        unitPx={unitPx}
        onResizeStart={onTerrainResizeStart}
        onRotateStart={onTerrainRotateStart}
      />

      {/* 底部「未设置底图」提示与右下缩放胶囊：摆放与说明都在 MapFloat 里 */}
      <MapFloat
        showBackdropHint={!hasBackground}
        percent={percent}
        onZoom={onZoom}
        onFit={onFit}
      />
    </>
  );
}
