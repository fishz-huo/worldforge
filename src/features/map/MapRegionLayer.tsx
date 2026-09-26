/**
 * 地图区域层（SVG）
 * ------------------------------------------------------------------
 * 用 viewBox="0 0 100 100" + preserveAspectRatio="none" 画多边形，
 * 因此归一化坐标可以原样使用，底图换分辨率也不会错位。
 *
 * 第二批：名称标签与顶点手柄搬到 MapRegionOverlay（屏幕空间），
 * 描边保持 vectorEffect="non-scaling-stroke"；预览模式下 hover 加实加粗并上报浮窗。
 *
 * 第三轮：多边形自己变成可拖的（按住内部 = 整体移动，见 useRegionGestures）。
 * 「拖顶点改形状」与「拖内部整体移动」的分工：顶点手柄在覆盖层最上层，
 * 命中顶点就是改形状；命中内部就是整体移动。平移态下两者都让路给画布。
 */
import type { MapRegion } from '@/types';
import { isPanPress } from './mapPan';
import { regionFill, regionPath, regionStroke } from './mapRender';
import type { MapViewMode } from './mapRender';
import type { SpotTarget } from './mapOverlay';

interface Props {
  regions: MapRegion[];
  /** 选中的区域 id 清单：框选会一次选中好几个 */
  selectedRegionIds: string[];
  /** 正在悬停（或触屏下点开）的区域：高亮它 */
  hoveredRegionId: string | null;
  /** 编辑 / 预览：预览下只读，也只有预览弹浮窗 */
  viewMode: MapViewMode;
  /** 平移态：不阻止冒泡、不选中、不拖动，把这一下让给画布 */
  panMode: boolean;
  /** 编辑模式 + 工具允许：按住区域内部整体移动 */
  regionMovable: boolean;
  mode: 'fill' | 'outline' | 'resource';
  metric: string;
  maxValue: number;
  onSelect: (regionId: string) => void;
  /** 按住内部开始整体移动（返回的是指针处理器，由这里贴到 path 上） */
  onDragStart: (region: MapRegion) => (e: React.PointerEvent) => void;
  onSpotHover?: (target: SpotTarget) => void;
  onSpotLeave?: () => void;
  onSpotTap?: (target: SpotTarget) => void;
}

export function MapRegionLayer({
  regions, selectedRegionIds, hoveredRegionId, viewMode, panMode, regionMovable, mode, metric,
  maxValue, onSelect, onDragStart, onSpotHover, onSpotLeave, onSpotTap,
}: Props) {
  const interactive = viewMode === 'preview';

  return (
    // data-surface：点到这个 SVG 上才算「点在底图上」，画布据此决定落点还是取消选中
    <svg data-surface="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      {regions.map((region) => {
        const active = selectedRegionIds.includes(region.id);
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
            className={panMode ? 'cursor-grab' : 'cursor-pointer'}
            onPointerDown={(e) => {
              // 平移优先（中键 / 平移态）：什么都不做、也不阻止冒泡，
              // 让画布根节点收到这一下去平移
              if (isPanPress(e.button, panMode)) return;
              if (e.button !== 0) return;
              if (interactive) {
                // 只上报（触屏弹抽屉用）：**不**阻止冒泡，否则从区域身上按下就没法平移了
                onSpotTap?.({ kind: 'region', id: region.id });
                return;
              }
              // Ctrl/⌘ 是「加顶点」手势，按住它不进拖动（否则拖完松手会多插一个点）
              if (!regionMovable || e.ctrlKey || e.metaKey) return;
              // 按下即选中：整体移动一步到位，不必先点一下再拖
              onSelect(region.id);
              onDragStart(region)(e);
            }}
            onClick={(e) => {
              // 平移态下单击不改选中（与「拖动只平移画布」同一套口径）
              if (panMode) return;
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
