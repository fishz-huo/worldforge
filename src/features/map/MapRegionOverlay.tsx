/**
 * 区域覆盖层：名称标签 + 顶点手柄（画在屏幕空间）
 * ==================================================================
 * 为什么从 SVG 里搬出来：区域多边形画在 viewBox="0 0 100 100" +
 * preserveAspectRatio="none" 的 SVG 里，一个 r=1 的圆在横向是画布宽的 2%、
 * 纵向是画布高的 2%，画布一拉宽手柄就成了扁椭圆（上一轮留下的 TODO）。
 * 现在底图能放到 6 倍，这个毛病会被一起放大 6 倍，所以这轮必须修。
 *
 * 做法：顶点与名称用 HTML 元素，位置由 mapViewport.toScreen() 从归一化坐标
 * 换算成屏幕像素 —— 天然是正圆，而且不随缩放变大变小（像 Google 地图：
 * 底图放大，标记与手柄的大小不变）。
 * 整个覆盖层 pointer-events-none，只有手柄自己开事件，免得挡住画布的落点。
 *
 * 第三轮的两件事：
 *   - 平移态下手柄让路（pointer-events: none）：否则按在顶点上就没法平移画布；
 *   - 按住 Alt 时光标换「−」，点一下删掉这个顶点（只剩 3 个时给禁止光标）。
 * 拖顶点与删顶点的实现都在 useRegionGestures，这里只管摆放与光标。
 */
import type { MapRegion } from '@/types';
import { centroid } from '@/types';
import { cn } from '@/lib/utils';
import { CURSOR_REMOVE_BLOCKED, CURSOR_REMOVE_VERTEX } from './mapCursors';
import type { MapViewMode } from './mapRender';

interface Props {
  regions: MapRegion[];
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  viewMode: MapViewMode;
  showLabels: boolean;
  /** 平移态：手柄让路给画布 */
  panMode: boolean;
  /** 按住 Alt：光标换「−」，点击即删 */
  altHeld: boolean;
  /** 归一化坐标 → 视口窗口内的像素 */
  toScreen: (nx: number, ny: number) => [number, number];
  /** 顶点的指针处理器（拖动改形状 / Alt 删顶点，由画布决定） */
  onVertexDown: (regionId: string, index: number) => (e: React.PointerEvent) => void;
}

export function MapRegionOverlay({
  regions, selectedRegionId, hoveredRegionId, viewMode, showLabels, panMode, altHeld, toScreen,
  onVertexDown,
}: Props) {
  return (
    // overflow-hidden：手柄/名称不跑到底图外面的留白区去
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {regions.map((region) => {
        const active = region.id === selectedRegionId;
        const hovered = region.id === hoveredRegionId;
        const [cx, cy] = centroid(region.points);
        const [labelX, labelY] = toScreen(cx, cy);
        /** 至少保留 3 个顶点：到 3 个时 Alt 点不动，光标也换成禁止 */
        const canDelete = region.points.length > 3;
        return (
          <div key={region.id}>
            {showLabels && (
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] leading-none"
                style={{
                  left: labelX,
                  top: labelY,
                  // 沿用原来 SVG 文字的观感：浅色字 + 深色描边（paintOrder）
                  color: '#e2e8f0',
                  textShadow: '0 0 3px #0b1220, 0 0 3px #0b1220',
                }}
              >
                {region.name}
              </span>
            )}

            {viewMode === 'edit' &&
              active &&
              region.points.map(([x, y], i) => {
                const [px, py] = toScreen(x, y);
                return (
                  <button
                    key={i}
                    type="button"
                    title={
                      altHeld
                        ? canDelete
                          ? '点击删除这个顶点（至少保留 3 个）'
                          : '至少保留 3 个顶点，不能再删'
                        : '拖动调整区域顶点 · 按住 Alt 可删除'
                    }
                    data-wf-map-vertex={`${region.id}:${i}`}
                    onPointerDown={onVertexDown(region.id, i)}
                    // 点手柄不能当成「点空白」把选中取消掉
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      left: px,
                      top: py,
                      cursor: altHeld ? (canDelete ? CURSOR_REMOVE_VERTEX : CURSOR_REMOVE_BLOCKED) : undefined,
                    }}
                    className={cn(
                      'pointer-events-auto absolute size-6 -translate-x-1/2 -translate-y-1/2 bg-transparent p-0',
                      altHeld && !canDelete ? 'cursor-not-allowed' : 'cursor-move',
                      panMode && 'pointer-events-none',
                    )}
                  >
                    <span
                      className="pointer-events-none absolute left-1/2 top-1/2 block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-white"
                      style={{
                        borderColor: region.color,
                        // 悬停/选中时给一点放大反馈，方便对准
                        boxShadow: hovered ? `0 0 0 2px ${region.color}55` : undefined,
                      }}
                    />
                  </button>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
