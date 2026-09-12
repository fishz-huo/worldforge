/**
 * 地图（Map / Pin / Region）
 * ------------------------------------------------------------------
 * 需求 2：可视化地图编辑器。
 * - 不做精细边界绘制，而是「底图 + 标记点 + 粗略多边形区域」。
 * - 一个世界观可以有多张地图（maps），用于承载不同时期 / 不同分支的地理与资源变化。
 * - 所有坐标为归一化值（0~1），因此底图缩放、窗口尺寸变化都不会错位。
 */
import type { Id, Stamps } from './common';

/** 区域资源结构：人口 / 农业 / 矿产等，数值化以便汇总与对比 */
export interface RegionResources {
  population?: number;
  agriculture?: number;
  mineral?: number;
  military?: number;
  trade?: number;
  /** 自定义资源，键名自由填写 */
  custom?: Record<string, number>;
}

/** 资源指标的展示定义 */
export interface ResourceMetric {
  key: keyof Omit<RegionResources, 'custom'>;
  label: string;
  unit: string;
  color: string;
}

/** 内置资源指标（地图资源面板与图例都读这里） */
export const RESOURCE_METRICS: ResourceMetric[] = [
  { key: 'population', label: '人口', unit: '万人', color: '#f59e0b' },
  { key: 'agriculture', label: '农业', unit: '指数', color: '#22c55e' },
  { key: 'mineral', label: '矿产', unit: '指数', color: '#94a3b8' },
  { key: 'military', label: '军力', unit: '指数', color: '#ef4444' },
  { key: 'trade', label: '商贸', unit: '指数', color: '#0ea5e9' },
];

/** 一张地图 */
export interface MapDef extends Stamps {
  id: Id;
  world_id: Id;
  branch_id: Id | null;
  name: string;
  description: string;
  /** 底图资源 id（为空则使用纯网格画布，可先摆点后补图） */
  asset_id: Id | null;
  /** 所属时期标签，例如「第三纪元 200 年」 */
  period: string;
  /** 该时期对应的刻度，便于和时间轴联动 */
  period_t: number | null;
  /** 底图不透明度 0~1 */
  opacity: number;
  meta: Record<string, unknown>;
}

/** 地图标记点（通常会绑定一张地点卡片） */
export interface MapPin {
  id: Id;
  map_id: Id;
  /** 绑定的卡片 id；可为空表示临时标记 */
  card_id: Id | null;
  /** 归一化坐标 0~1 */
  x: number;
  y: number;
  label: string;
  /** 图标（emoji 或 lucide 名） */
  icon: string;
  color: string;
  note: string;
}

/** 地图区域（行政区 / 势力范围 / 资源区） */
export interface MapRegion {
  id: Id;
  map_id: Id;
  name: string;
  color: string;
  /** 归一化多边形顶点 [[x,y], ...] */
  points: [number, number][];
  resources: RegionResources;
  /** 归属时期，用于跨地图对比 */
  period: string;
  note: string;
}

/** 地图编辑器的交互工具 */
export type MapTool = 'select' | 'pin' | 'region' | 'pan';

/** 新建地图时的默认值 */
export function emptyMap(worldId: Id, branchId: Id | null, name: string): Omit<MapDef, 'id' | 'created_at' | 'updated_at'> {
  return {
    world_id: worldId,
    branch_id: branchId,
    name,
    description: '',
    asset_id: null,
    period: '',
    period_t: null,
    opacity: 0.9,
    meta: {},
  };
}

/** 归一化坐标裁剪，避免拖拽出界 */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 计算多边形的重心，用于放置区域名称标签 */
export function centroid(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0.5, 0.5];
  const sum = points.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}
