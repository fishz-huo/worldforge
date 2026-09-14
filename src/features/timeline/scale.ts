/**
 * 时间轴坐标换算（纯函数）
 * ==================================================================
 * 需求：放大之后要能拖着滚动条看完整条时间轴，并且刻度、条目、游标
 * 在任意缩放级别下都对齐。
 *
 * 为什么要有这个文件：v0.2 之前时间轴用「可见区间 viewport」表达缩放 ——
 * 渲染时一律按 `(t - start) / span` 算成百分比。百分比定位意味着内容
 * **永远被铺满在容器宽度里**，放大只是让刻度变密、条目被裁掉，
 * 横向没有任何可滚动的像素，所以"拖滚动条看被裁掉的部分"根本不可能。
 *
 * 新模型（与 AE / PR 一致）：时间轴的总长度是固定的，缩放改的是
 * 「一个刻度单位占多少像素」。于是浏览器原生的横向滚动条自然就有了。
 *
 * 这里刻意只放数学，不碰 React 也不碰 DOM：坐标算错是"看着不对但说不出哪不对"
 * 的那类 bug，只有纯函数才能在 Node 里反复验（见 timeline-align-selftest.mjs）。
 */
import { niceStep } from '@/types';

/** 世界跨度的兜底值：一个还没有任何条目的世界观，时间轴也得有个可画的长度 */
export const MIN_FULL_SPAN = 10;

/** 每刻度单位的像素数（缩放状态的真正载体） */
export const MIN_PX_PER_UNIT = 0.02;
export const MAX_PX_PER_UNIT = 4000;

/** 一次缩放最多改变多少倍，避免滚轮一格就飞出可视范围 */
export const ZOOM_STEP = 1.25;

/** 时间范围 */
export interface TimeRange {
  min: number;
  max: number;
}

/**
 * 把范围按比例外扩（留白），返回带 padding 的新范围。
 *
 * 为什么右边要比左边多留：刻度值是**从刻度线往右写**的（`0 年`、`350 年`）。
 * 两边留白一样时，最后一个刻度的文字会伸出内容框，"适配全部"之后横向
 * 仍然能滚 —— 看上去就像没对齐。右边多留 `labelPad` 一份正好放得下它。
 */
export function padRange(range: TimeRange, ratio = 0.06, labelPad = ratio): TimeRange {
  const span = Math.max(MIN_FULL_SPAN, range.max - range.min);
  return { min: range.min - span * ratio, max: range.max + span * labelPad };
}

/** 把整个时间轴的跨度换算成像素宽度（内容还没准备好时至少给 1，避免除以 0） */
export function contentWidth(range: TimeRange, pxPerUnit: number): number {
  return Math.max(1, (range.max - range.min) * pxPerUnit);
}

/** 刻度 → 内容坐标（像素，相对内容起点） */
export function timeToX(t: number, range: TimeRange, pxPerUnit: number): number {
  return (t - range.min) * pxPerUnit;
}

/** 内容坐标 → 刻度 */
export function xToTime(x: number, range: TimeRange, pxPerUnit: number): number {
  return range.min + x / pxPerUnit;
}

/** 把像素宽度换算成时间长度（拖动条目条时用） */
export function pxToSpan(px: number, pxPerUnit: number): number {
  return px / pxPerUnit;
}

/**
 * 缩放后要让某个时间点**停在屏幕上的同一位置**（滚轮缩放的手感全靠它）。
 * @param anchorPx 该刻度在**视口内**的像素位置（相对容器左边缘）
 */
export function scrollLeftToKeep(anchorTime: number, anchorPx: number, range: TimeRange, newPxPerUnit: number): number {
  return timeToX(anchorTime, range, newPxPerUnit) - anchorPx;
}

/**
 * 让某个时间点居中：返回应该设置的 scrollLeft（「定位到该条目」用得到）。
 *
 * @param fixedLeftPx 滚动容器**内部**左侧被固定住的宽度（例如 sticky 的名称列）。
 *   固定列压住左边时，中点会跑到固定列底下 —— 这是最容易犯的居中错误。
 */
export function scrollLeftToCenter(
  t: number, viewportPx: number, range: TimeRange, pxPerUnit: number, fixedLeftPx = 0,
): number {
  return timeToX(t, range, pxPerUnit) - (viewportPx - fixedLeftPx) / 2;
}

/**
 * 根据可用宽度算一个「刚好装下全部条目」的比例尺（原来的「适配全部条目」）。
 * range 必须是**已经 padRange 过**的那个，viewportPx 必须是扣掉名称列之后的宽度。
 */
export function fitPxPerUnit(range: TimeRange, viewportPx: number): number {
  const span = Math.max(MIN_FULL_SPAN, range.max - range.min);
  return clampPxPerUnit(viewportPx / span);
}

/**
 * 比例尺夹取。
 *   - Infinity 是「太大了」→ 夹到上限；
 *   - NaN / 负数 / 0 是「这个值算坏了」→ 给中性值 1（不是最小值：
 *     把坏值夹成最小值，界面看起来就像"缩放坏了"，而 1 只是"没缩放"）。
 * 正常的缩放过小由 zoomBy 处理，不会走到这里。
 */
export function clampPxPerUnit(value: number): number {
  if (value === Infinity) return MAX_PX_PER_UNIT;
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(MAX_PX_PER_UNIT, Math.max(MIN_PX_PER_UNIT, value));
}

/**
 * 缩放一步：factor > 1 放大。倍数算坏给中性值 1（"没反应"好过"突然缩到最小"），
 * 倍数 <= 0 缩到最小，正常倍数乘完夹到区间内。
 */
export function zoomBy(pxPerUnit: number, factor: number): number {
  if (Number.isNaN(factor) || !Number.isFinite(factor)) return 1;
  if (factor <= 0) return MIN_PX_PER_UNIT;
  return clampPxPerUnit(pxPerUnit * factor);
}

/**
 * 刻度步长与「好看的 1/2/5 × 10ⁿ」规则沿用 types/timeline.ts 的 niceStep，
 * 不再实现第二份 —— 两处各写一套迟早会出现"刻度尺和吸附用的步长不一样"。
 */
export { niceStep } from '@/types';

/**
 * 按屏幕像素密度决定刻度步长与要画的刻度序列。
 *
 * `viewportPx` 必须是**真正能画图的那一段宽度**（滚动容器宽度 − 名称列宽度）：
 * 多算一列会把可视右边界推到内容之外，最右边就多画一个刻度，它的文字
 * 伸出内容框 —— 用户看到的是"最后那个刻度被切了一半"。
 *
 * @param minLabelPx 两个刻度之间至少留多少像素（避免标签叠在一起）
 */
export function visibleTicks(
  range: TimeRange,
  pxPerUnit: number,
  viewportPx: number,
  scrollLeft: number,
  minLabelPx = 90,
): number[] {
  const visibleSpan = viewportPx / pxPerUnit;
  const step = niceStep(visibleSpan, Math.max(1, Math.floor(viewportPx / minLabelPx)));
  const from = xToTime(scrollLeft, range, pxPerUnit);
  const to = xToTime(scrollLeft + viewportPx, range, pxPerUnit);
  const first = Math.ceil(from / step) * step;
  const out: number[] = [];
  // 上限兜底：极端缩放下（比例尺很大）避免生成几十万个刻度把界面拖死
  for (let t = first; t <= to && out.length < 500; t += step) {
    out.push(Math.round(t * 1e6) / 1e6);
  }
  return out;
}

/**
 * 拖拽吸附：把刻度吸到「当前可见刻度步长」的整数倍上。
 * 按住 Shift 拖动条目时用，手感与视频剪辑软件一致。
 *
 * 步长只取决于屏幕密度与比例尺，与内容范围无关 —— 所以 range 参数
 * 现在是**保留位**（调用方按统一签名传，不必记哪个函数要哪个不要）。
 */
export function snapTime(t: number, range: TimeRange, pxPerUnit: number, viewportPx: number): number {
  void range;
  const step = niceStep(viewportPx / pxPerUnit, Math.max(1, Math.floor(viewportPx / 90)));
  return Math.round(t / step) * step;
}

/** 计算所有内容的时间范围（条目 + 纪元）。全空时给一个以 0 为中心的默认跨度 */
export function fullRangeOf(entries: { start_t: number; end_t: number | null }[], eras: { start_t: number; end_t: number }[] = []): TimeRange {
  const values: number[] = [0];
  entries.forEach((e) => {
    values.push(e.start_t);
    if (e.end_t !== null && Number.isFinite(e.end_t)) values.push(e.end_t);
  });
  eras.forEach((e) => {
    if (Number.isFinite(e.start_t)) values.push(e.start_t);
    if (Number.isFinite(e.end_t)) values.push(e.end_t);
  });
  const min = Math.min(...values);
  const max = Math.max(...values);
  // 所有值都一样（例如只有一条瞬时条目）时给一个最小跨度，否则内容宽度为 0
  if (max - min < MIN_FULL_SPAN) {
    const mid = (min + max) / 2;
    return { min: mid - MIN_FULL_SPAN / 2, max: mid + MIN_FULL_SPAN / 2 };
  }
  return { min, max };
}
