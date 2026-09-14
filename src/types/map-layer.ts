/**
 * 地图图层（MapLayer）
 * ------------------------------------------------------------------
 * 需求 2 的延伸：一张地图由多层底图叠成，像绘画软件那样能调顺序、
 * 显隐与不透明度 —— 但不做手绘，仍然是「底图 + 标记点 + 区域」。
 *
 * 为什么图层不带上位移与缩放：标记点与区域存的是相对**画布**的归一化坐标，
 * 一旦允许单独平移某一层，层上的标记就会跟着错位。1.0 先只做
 * 顺序 / 显隐 / 不透明度 / 混合模式这四件事（也正是绘画软件里最常用的），
 * 既能解决「上层遮住下层看不见」，又不会让坐标语义变复杂。
 */
import type { Id } from './common';

/** 图层混合模式（与 CSS mix-blend-mode 同名同义） */
export type MapBlend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export const MAP_BLENDS: { value: MapBlend; label: string }[] = [
  { value: 'normal', label: '正常' },
  { value: 'multiply', label: '正片叠底' },
  { value: 'screen', label: '滤色' },
  { value: 'overlay', label: '叠加' },
  { value: 'darken', label: '变暗' },
  { value: 'lighten', label: '变亮' },
];

/** 一个图层 */
export interface MapLayer {
  id: Id;
  map_id: Id;
  name: string;
  /** 底图资源 id；为空表示这是一个占位层（先把层建好，之后再传图） */
  asset_id: Id | null;
  /** 不透明度 0~1 */
  opacity: number;
  /** 1 = 显示，0 = 隐藏（隐藏而不是删除，方便对照） */
  visible: number;
  /** 叠放顺序：数字大的在上层 */
  order_index: number;
  blend: MapBlend;
  created_at: number;
}

/** 新建图层的默认值 */
export function emptyLayer(mapId: Id, name: string, order = 0): Omit<MapLayer, 'id' | 'created_at'> {
  return {
    map_id: mapId,
    name,
    asset_id: null,
    opacity: 1,
    visible: 1,
    order_index: order,
    blend: 'normal',
  };
}

/** 把不透明度夹到 0~1（滑杆与手写数值都会经过这里） */
export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

/** 按叠放顺序排序（数字大的在上层，渲染时从下往上画） */
export function sortLayers(layers: MapLayer[]): MapLayer[] {
  return [...layers].sort((a, b) => a.order_index - b.order_index);
}
