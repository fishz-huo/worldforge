/**
 * 地图浮窗的摆位数学
 * ==================================================================
 * 需求：浮窗支持边缘碰撞检测（贴到屏幕边缘时自动翻转方向）。
 * 和视口一样，这件事的失败方式是「看着有点怪」而不是报错 ——
 * 卡片下缘被屏幕切掉、贴右边缘时有一半在屏幕外。所以抽成纯函数，
 * 由 scripts/map-viewport-selftest.mjs 一起验。
 *
 * 规则（从上到下依次尝试）：
 *   1. 默认放在锚点正下方（留 8px 空隙）；
 *   2. 下方放不下就翻到正上方；
 *   3. 上下都放不下（卡片比可视区还高）就挑空间大的一侧，再夹进边距内；
 *   4. 水平方向以锚点中线对齐，并夹进 [边距, 视口宽 - 卡片宽 - 边距]。
 */

/** 矩形（DOM 的 getBoundingClientRect 正好是这个形状） */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 卡片尺寸 */
export interface OverlaySize {
  width: number;
  height: number;
}

/** 摆位结果：left/top 是 fixed 定位坐标；side 表示落在锚点的哪一侧 */
export interface OverlayPlacement {
  left: number;
  top: number;
  side: 'top' | 'bottom';
}

/** 浮窗与锚点的空隙、与屏幕边缘的最小留白 */
export const OVERLAY_GAP = 8;
export const OVERLAY_MARGIN = 8;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** 要弹出浮窗的目标（标记点或区域） */
export interface SpotTarget {
  kind: 'pin' | 'region';
  id: string;
  /** 锚点矩形（元素当时的屏幕位置）；底部抽屉不需要它，标成可选 */
  anchor?: Rect;
}

/** 计算浮窗位置（纯函数：同样的输入永远同样的输出） */
export function placeOverlay(
  anchor: Rect,
  size: OverlaySize,
  viewport: OverlaySize,
  opts?: { gap?: number; margin?: number },
): OverlayPlacement {
  const gap = opts?.gap ?? OVERLAY_GAP;
  const margin = opts?.margin ?? OVERLAY_MARGIN;
  // 视口比卡片还小时，max 会小于 min，clamp 需要自己兜住
  const maxTop = Math.max(margin, viewport.height - size.height - margin);
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);

  const below = anchor.top + anchor.height + gap;
  const above = anchor.top - gap - size.height;
  const belowFits = below <= maxTop;
  const aboveFits = above >= margin;

  // 上下都放不下时挑空间大的一侧（锚点在下半屏就往上放）
  const preferBottom = anchor.top + anchor.height / 2 < viewport.height / 2;
  const side: 'top' | 'bottom' = belowFits ? 'bottom' : aboveFits ? 'top' : preferBottom ? 'bottom' : 'top';

  const top = clamp(side === 'bottom' ? below : above, margin, maxTop);
  const left = clamp(anchor.left + anchor.width / 2 - size.width / 2, margin, maxLeft);
  return { left, top, side };
}
