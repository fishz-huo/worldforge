/**
 * 地图区域层（SVG）
 * ------------------------------------------------------------------
 * 用 viewBox="0 0 100 100" + preserveAspectRatio="none" 画多边形，
 * 因此归一化坐标可以原样使用，底图换分辨率也不会错位。
 * 选中区域时显示可拖动的顶点手柄。
 */
import type { MapRegion } from '@/types';
import { centroid } from '@/types';
import { regionFill, regionPath } from './mapRender';

interface Props {
  regions: MapRegion[];
  selectedRegionId: string | null;
  mode: 'fill' | 'outline' | 'resource';
  metric: string;
  maxValue: number;
  showLabels: boolean;
  onSelect: (regionId: string) => void;
  onPointMove: (regionId: string, index: number, x: number, y: number) => void;
  /** 客户端坐标 → 归一化坐标 */
  toNorm: (clientX: number, clientY: number) => [number, number];
}

export function MapRegionLayer({
  regions, selectedRegionId, mode, metric, maxValue, showLabels, onSelect, onPointMove, toNorm,
}: Props) {
  /** 拖动手柄：用 window 级监听，避免鼠标移出小圆点就中断 */
  const startDrag = (regionId: string, index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
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
    <svg data-surface="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      {regions.map((region) => {
        const active = region.id === selectedRegionId;
        const [cx, cy] = centroid(region.points);
        return (
          <g key={region.id}>
            <path
              d={regionPath(region)}
              fill={regionFill(region, mode, metric, maxValue)}
              stroke={active ? '#ffffff' : region.color}
              strokeWidth={active ? 0.6 : 0.35}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(region.id);
              }}
            />
            {showLabels && (
              <text
                x={cx * 100}
                y={cy * 100}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{ fontSize: 3, fill: '#e2e8f0', paintOrder: 'stroke', stroke: '#0b1220', strokeWidth: 0.6 }}
              >
                {region.name}
              </text>
            )}
            {active &&
              region.points.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x * 100}
                  cy={y * 100}
                  r={1}
                  fill="#ffffff"
                  stroke={region.color}
                  strokeWidth={0.4}
                  className="cursor-move"
                  onPointerDown={startDrag(region.id, i)}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}
