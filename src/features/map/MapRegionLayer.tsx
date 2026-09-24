/**
 * 地图区域层（SVG）
 * ------------------------------------------------------------------
 * 用 viewBox="0 0 100 100" + preserveAspectRatio="none" 画多边形，
 * 因此归一化坐标可以原样使用，底图换分辨率也不会错位。
 *
 * 第二批的改动：
 *   - 名称标签与顶点手柄**搬到 MapRegionOverlay**（屏幕空间）：
 *     在 viewBox 里半径 1 实际等于画布宽/高各 2%，画布一拉宽手柄就成扁椭圆
 *     （上一轮留下的 TODO）；底图能缩放到 6 倍后这个毛病会被一起放大，
 *     所以这轮必须修；
 *   - 描边保持 vectorEffect="non-scaling-stroke"：缩放时始终是 1px 细线；
 *   - 预览模式下 hover 把描边加实加粗，并上报浮窗。
 */
import type { MapRegion } from '@/types';
import { regionFill, regionPath, regionStroke } from './mapRender';
import type { MapViewMode } from './mapRender';
import type { SpotTarget } from './mapOverlay';

interface Props {
  regions: MapRegion[];
  selectedRegionId: string | null;
  /** 正在悬停（或触屏下点开）的区域：高亮它 */
  hoveredRegionId: string | null;
  /** 编辑 / 预览：预览下只读，也只有预览弹浮窗 */
  viewMode: MapViewMode;
  mode: 'fill' | 'outline' | 'resource';
  metric: string;
  maxValue: number;
  onSelect: (regionId: string) => void;
  onSpotHover?: (target: SpotTarget) => void;
  onSpotLeave?: () => void;
  onSpotTap?: (target: SpotTarget) => void;
}

export function MapRegionLayer({
  regions, selectedRegionId, hoveredRegionId, viewMode, mode, metric, maxValue, onSelect,
  onSpotHover, onSpotLeave, onSpotTap,
}: Props) {
  const interactive = viewMode === 'preview';

  return (
    // data-surface：点到这个 SVG 上才算「点在底图上」，画布据此决定落点还是取消选中
    <svg data-surface="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      {regions.map((region) => {
        const active = region.id === selectedRegionId;
        const hovered = region.id === hoveredRegionId;
        const stroke = regionStroke(region, active || hovered);
        return (
          <path
            key={region.id}
            data-wf-map-region={region.id}
            d={regionPath(region)}
            fill={regionFill(region, mode, metric, maxValue)}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeOpacity={stroke.opacity}
            vectorEffect="non-scaling-stroke"
            className="cursor-pointer"
            onPointerDown={() => {
              // 只上报（触屏弹抽屉用）：**不**阻止冒泡，否则从区域身上按下就没法平移了
              if (interactive) onSpotTap?.({ kind: 'region', id: region.id });
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(region.id);
            }}
            onPointerEnter={
              interactive
                ? (e) => onSpotHover?.({ kind: 'region', id: region.id, anchor: e.currentTarget.getBoundingClientRect() })
                : undefined
            }
            onPointerLeave={interactive ? () => onSpotLeave?.() : undefined}
          />
        );
      })}
    </svg>
  );
}
