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
 */
import type { MapRegion } from '@/types';
import { centroid } from '@/types';
import type { MapViewMode } from './mapRender';

interface Props {
  regions: MapRegion[];
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  viewMode: MapViewMode;
  showLabels: boolean;
  /** 归一化坐标 → 视口窗口内的像素 */
  toScreen: (nx: number, ny: number) => [number, number];
  /** 客户端坐标 → 归一化坐标（拖顶点用） */
  toNorm: (clientX: number, clientY: number) => [number, number];
  onPointMove: (regionId: string, index: number, x: number, y: number) => void;
}

export function MapRegionOverlay({
  regions, selectedRegionId, hoveredRegionId, viewMode, showLabels, toScreen, toNorm, onPointMove,
}: Props) {
  /** 拖顶点：用 window 级监听，鼠标移出小圆点也不会中断 */
  const startDrag = (regionId: string, index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      // 预览模式不写坐标（手柄本来就不渲染，这里再兜一层）
      if (viewMode !== 'edit') return;
      const [x, y] = toNorm(ev.clientX, ev.clientY);
      onPointMove(regionId, index, x, y);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    // overflow-hidden：手柄/名称不跑到底图外面的留白区去
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {regions.map((region) => {
        const active = region.id === selectedRegionId;
        const hovered = region.id === hoveredRegionId;
        const [cx, cy] = centroid(region.points);
        const [labelX, labelY] = toScreen(cx, cy);
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
                    title="拖动调整区域顶点"
                    data-wf-map-vertex={`${region.id}:${i}`}
                    onPointerDown={startDrag(region.id, i)}
                    // 点手柄不能当成「点空白」把选中取消掉
                    onClick={(e) => e.stopPropagation()}
                    style={{ left: px, top: py }}
                    className="pointer-events-auto absolute size-6 -translate-x-1/2 -translate-y-1/2 cursor-move bg-transparent p-0"
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
