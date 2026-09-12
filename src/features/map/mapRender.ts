/**
 * 地图渲染工具
 * ------------------------------------------------------------------
 * 坐标与着色的小函数集中在这里，供画布、区域层、图例复用。
 */
import type { MapRegion } from '@/types';

/**
 * 资源热度着色：0 → 蓝，100 → 红。
 * 用 HSL 色相线性插值即可得到直觉上的「冷 → 热」，
 * 不需要引入色彩库。
 */
export function heatColor(value: number | undefined, alpha = 0.35): string {
  const ratio = Math.max(0, Math.min(100, value ?? 0)) / 100;
  return `hsl(${210 - 210 * ratio} 85% 55% / ${alpha})`;
}

/** 多边形 → SVG path（viewBox 固定 0 0 100 100，用百分比坐标画） */
export function regionPath(region: MapRegion): string {
  return (
    region.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x * 100} ${y * 100}`).join(' ') + ' Z'
  );
}

/** 把归一化坐标限制在画布内 */
export function clampNorm(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 由区域资源与指标决定填充色 */
export function regionFill(
  region: MapRegion,
  mode: 'fill' | 'outline' | 'resource',
  metric: string,
  maxValue: number,
): string {
  if (mode === 'outline') return 'transparent';
  if (mode === 'resource') {
    const value = Number((region.resources as Record<string, unknown>)?.[metric] ?? 0);
    return heatColor((value / Math.max(1, maxValue)) * 100, 0.45);
  }
  return `${region.color}44`;
}
