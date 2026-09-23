/**
 * 地图渲染工具
 * ------------------------------------------------------------------
 * 坐标与着色的小函数集中在这里，供画布、区域层、图例复用。
 */
import type { MapRegion } from '@/types';

/**
 * 地图视图模式
 * ------------------------------------------------------------------
 * edit = 可写（打点、拖顶点、改属性…）；preview = 纯查看。
 * 定义放在渲染层而不是 src/types：它不进数据库、不进 store，
 * 换模块或刷新就回到 edit（约束不允许动 store 与偏好文件）。
 */
export type MapViewMode = 'edit' | 'preview';

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
  // 35%：设计稿是 27%，用户要求 30~40%，取中值让色块看得清、又能透出底图
  return `${region.color}59`;
}

/**
 * 区域描边：与填充分离的细边，选中时更实更粗一点。
 * 未选中也留一条 1px 半透明边 —— 浅灰画布上没有边的话，
 * 相邻区域会糊成一坨分不清（用户确认过这个取舍）。
 */
export function regionStroke(
  region: MapRegion,
  active: boolean,
): { color: string; width: number; opacity: number } {
  return { color: region.color, width: active ? 1.5 : 1, opacity: active ? 1 : 0.6 };
}
