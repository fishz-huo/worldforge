/**
 * 框选（CAD 式窗选 / 交叉选）：方向语义与命中判定（纯函数，有自测）
 * ==================================================================
 * 用户 2026-09-25 的需求：编辑模式下在空白处左键拖出一个虚框，框住的
 * 区域 / 标记点 / 地形符号一起选中，检查器显示「已选中 N 个对象」并可批量删除。
 *
 * **方向语义按 AutoCAD 的既有习惯**（用户让我按 CAD 习惯判断）：
 *   从左往右拖 = 窗选（window）：对象要**完全落在框内**才算；
 *   从右往左拖 = 交叉选（crossing）：碰到就算 —— 这正是 CAD 里两种框的
 *   颜色与线型不同的原因，画法见 MapMarqueeLayer。
 *
 * 这里只有「给定屏幕矩形与候选几何，返回命中清单」这段可以逐条钉住的数学：
 * 起手条件（编辑模式 / 工具 / 空白 / 修饰键）、4px 阈值、Shift 追加这些**策略**
 * 在 useMarquee；对象在屏幕上的形状在 mapMarqueeTargets。
 */
import type { MapTool } from '@/types';
import type { MarqueeCandidate } from './mapMarqueeTargets';
import type { MapSelectionItem } from './mapSelection';
import type { MapViewMode } from './mapRender';

/** 位移超过它才算框选（与 useMapViewport 的平移阈值同值）：以下原样留给点击语义 */
export const MARQUEE_THRESHOLD = 4;

/** 屏幕空间的矩形（客户端像素，left ≤ right / top ≤ bottom 由 boxOf 保证） */
export interface MarqueeBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 两种口径：窗选要完全框住，交叉选碰到就算 */
export type MarqueeMode = 'window' | 'crossing';

/** 拖拽方向定语义：从左往右（含原地）＝ 窗选，从右往左 ＝ 交叉选 */
export function marqueeMode(x0: number, x1: number): MarqueeMode {
  return x1 < x0 ? 'crossing' : 'window';
}

/** 两个对角点 → 规范化矩形（无论往哪个方向拖，都是 left/top/right/bottom） */
export function boxOf(x0: number, y0: number, x1: number, y1: number): MarqueeBox {
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    right: Math.max(x0, x1),
    bottom: Math.max(y0, y1),
  };
}

/** 点是否落在矩形内（闭区间：正好贴边、正好在角上都算） */
function pointInBox(p: [number, number], box: MarqueeBox): boolean {
  return p[0] >= box.left && p[0] <= box.right && p[1] >= box.top && p[1] <= box.bottom;
}

function boxCorners(box: MarqueeBox): [number, number][] {
  return [[box.left, box.top], [box.right, box.top], [box.right, box.bottom], [box.left, box.bottom]];
}

/** 奇偶射线法：点是否在多边形内（顶点贴着边界时结果不定，调用方另有贴边判定兜底） */
export function pointInPoly(p: [number, number], poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** p 是否落在线段 ab 上（含端点与共线） */
function onSegment(p: [number, number], a: [number, number], b: [number, number]): boolean {
  if (Math.abs(cross(a, b, p)) > 1e-9) return false;
  return p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
    && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
}

/** 两条线段是否相交（含相切、共线贴边 —— 交叉选里"擦到边"就该算命中） */
export function segmentsCross(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b);
}

/** 线段是否与矩形相交 */
export function segmentHitsBox(
  a: [number, number],
  b: [number, number],
  box: MarqueeBox,
): boolean {
  if (pointInBox(a, box) || pointInBox(b, box)) return true;
  const corners = boxCorners(box);
  for (let i = 0; i < corners.length; i += 1) {
    if (segmentsCross(a, b, corners[i], corners[(i + 1) % corners.length])) return true;
  }
  return false;
}

/** 单个对象是否命中（窗选 = 顶点全在框内；交叉选 = 顶点/边/框角三者任一沾上） */
export function hitOne(candidate: MarqueeCandidate, box: MarqueeBox, mode: MarqueeMode): boolean {
  const pts = candidate.points;
  if (pts.length === 0) return false;
  if (mode === 'window') return pts.every((p) => pointInBox(p, box));
  if (pts.some((p) => pointInBox(p, box))) return true;
  // 框整个落在对象**内部**（大区域包住小框）：一个顶点都没碰到，但确实压在它身上
  if (boxCorners(box).some((p) => pointInPoly(p, pts))) return true;
  for (let i = 0; i < pts.length; i += 1) {
    if (segmentHitsBox(pts[i], pts[(i + 1) % pts.length], box)) return true;
  }
  return false;
}

/** 命中清单：按候选顺序输出（＝ 标记 → 地形 → 区域），不重复 */
export function hitsOf(
  candidates: MarqueeCandidate[],
  box: MarqueeBox,
  mode: MarqueeMode,
): MapSelectionItem[] {
  const out: MapSelectionItem[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!hitOne(candidate, box, mode)) continue;
    const key = `${candidate.kind}:${candidate.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: candidate.kind, id: candidate.id });
  }
  return out;
}

/** 这一下按下能不能起框（策略，见文件头；useMarquee 在捕获阶段调用它） */
export interface MarqueeEligibility {
  viewMode: MapViewMode;
  tool: MapTool;
  /** 平移态（平移工具 / 按住空格） */
  panMode: boolean;
  /** 地形笔刷激活中 */
  brushActive: boolean;
  /** 这一下是不是按在图钉 / 区域 / 顶点 / 地形手柄上 */
  onSpot: boolean;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export function marqueeEligible(o: MarqueeEligibility): boolean {
  // 预览是只读的：那里左键拖空白已经用来平移画布了
  if (o.viewMode !== 'edit') return false;
  // 平移与笔刷优先：左键在它们手里
  if (o.panMode || o.brushActive) return false;
  // 打点工具下拖空白＝落标记；平移工具已由 panMode 拦住
  if (o.tool !== 'select' && o.tool !== 'region') return false;
  // 按在对象上是选中/拖动（会写库），中键右键也不是框选
  if (o.onSpot || o.button !== 0) return false;
  // Ctrl/⌘ 加顶点、Alt 删顶点：都不参与框选
  return !o.ctrlKey && !o.metaKey && !o.altKey;
}
