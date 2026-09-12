/**
 * 时间轴（Track / TimelineEntry / Era）
 * ------------------------------------------------------------------
 * 需求 3：可视化时间轴。
 * 设计要点：
 *  - 时间用「数值刻度」而非日期字符串：世界观的历法千奇百怪，数值最通用，
 *    显示时再由 world.meta.time 的 unit / zeroLabel 翻译成「第三纪元 245 年」。
 *  - 泳道（Track）分门别类：事件、角色生命线、地理变化、科技水平、底层设定…
 *  - 条目可绑定卡片（card_id），从而「事件 ↔ 卡片 ↔ 关联 ↔ 地图」全部串起来。
 *  - 角色泳道用 birth/death 推算任意时刻年龄；state 记录该时段身份状态。
 */
import type { Id } from './common';

/** 泳道类别 */
export type TrackKind = 'event' | 'character' | 'geo' | 'tech' | 'lore' | 'faction' | 'custom';

/** 泳道类别元信息 */
export interface TrackKindDef {
  kind: TrackKind;
  label: string;
  color: string;
  icon: string;
  hint: string;
}

/** 内置泳道类别 */
export const TRACK_KINDS: TrackKindDef[] = [
  { kind: 'event', label: '事件', color: '#f59e0b', icon: 'Zap', hint: '有起止的历史事件' },
  { kind: 'character', label: '角色生命线', color: '#8b5cf6', icon: 'User', hint: '按出生/死亡刻度推算年龄与状态' },
  { kind: 'geo', label: '地理变化', color: '#0ea5e9', icon: 'Mountain', hint: '地形、疆域、灾变等地理变迁' },
  { kind: 'tech', label: '科技水平', color: '#22c55e', icon: 'Cpu', hint: '技术发展阶段与突破点' },
  { kind: 'lore', label: '底层设定', color: '#10b981', icon: 'Atom', hint: '世界规则、魔法体系的演变' },
  { kind: 'faction', label: '势力', color: '#ef4444', icon: 'Flag', hint: '势力的兴衰起止' },
  { kind: 'custom', label: '自定义', color: '#a855f7', icon: 'Layers', hint: '自由泳道' },
];

/** 泳道 */
export interface Track {
  id: Id;
  world_id: Id;
  branch_id: Id | null;
  name: string;
  kind: TrackKind;
  color: string;
  order_index: number;
  /** 是否隐藏（不影响数据） */
  hidden: number;
  /** 科技/数值型泳道可用：把条目数值映射为折线 */
  valued: number;
}

/** 时间轴条目 */
export interface TimelineEntry {
  id: Id;
  world_id: Id;
  branch_id: Id | null;
  track_id: Id;
  /** 关联卡片（事件卡 / 角色卡 / 地点卡…） */
  card_id: Id | null;
  title: string;
  /** 起止刻度；瞬时事件 end_t = null */
  start_t: number;
  end_t: number | null;
  /** 1 = 瞬时点事件 */
  instant: number;
  note: string;
  /** 该时段的状态描述（角色身份、地区局势…） */
  state: string;
  /** 科技泳道使用：水平数值 0~100 */
  value: number | null;
  /** 关联地图：这一条对应哪张地图/哪些区域 */
  map_id: Id | null;
  created_at: number;
}

/** 纪元分段：时间轴背景色带 */
export interface Era {
  id: Id;
  world_id: Id;
  name: string;
  start_t: number;
  end_t: number;
  color: string;
  note: string;
}

/** 时间轴视图状态（缩放与平移） */
export interface Viewport {
  /** 可见区间 */
  start: number;
  end: number;
}

/** 把刻度格式化为可读文本，例如 245 → 「245 年」 */
export function formatTick(t: number | null | undefined, unit = '年'): string {
  if (t === null || t === undefined || Number.isNaN(t)) return '—';
  const rounded = Math.round(t * 100) / 100;
  return `${rounded} ${unit}`;
}

/** 计算某角色在刻度 t 的年龄；缺少出生刻度时返回 null */
export function ageAt(birthT: number | null, t: number, factor = 1): number | null {
  if (birthT === null) return null;
  return Math.round((t - birthT) * factor * 100) / 100;
}

/** 条目在时间轴上的可见区间（瞬时事件给一个最小宽度） */
export function entrySpan(e: TimelineEntry, minSpan: number): [number, number] {
  const end = e.instant === 1 || e.end_t === null ? e.start_t + minSpan : e.end_t;
  return [Math.min(e.start_t, end), Math.max(e.start_t, end)];
}

/** 判断两个刻度区间是否重叠 */
export function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/** 生成「好看」的刻度步长：1/2/5 × 10^n */
export function niceStep(span: number, targetTicks = 10): number {
  const raw = span / Math.max(1, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}
