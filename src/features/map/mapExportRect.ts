/**
 * 地图导出：范围矩形、倍数、文件名（纯函数，有自测）
 * ==================================================================
 * 第四批「导出为图片」。这一层只有数学与字符串，不碰 DOM、不碰 store：
 *   - 导出矩形：把「当前视口 / 整张底图」统一成世界像素里的一个矩形；
 *   - 折算比 s：屏幕上 1 个世界像素等于几个 CSS 像素（由视口的 toScreenPixel
 *     反推）。图钉那种**屏幕固定尺寸**的东西一律 ÷s 折成世界像素再画，
 *     所以「当前视口」导出的图与屏幕上看到的逐像素一致（见 mapExportSvg）；
 *   - 倍数夹取：canvas 有尺寸上限，3× 该降就降，并把「实际用了几倍」报出去
 *     （静默降级比报错更难查）。
 */
import { safeFileName } from '@/lib/save-open';
import type { Size } from './mapViewport';

export type ExportFormat = 'png' | 'jpeg' | 'svg';
export type ExportScope = 'viewport' | 'full';
export type ExportScale = 1 | 2 | 3;
export type RegionMode = 'fill' | 'outline' | 'resource';

/** 可选倍数（顺序 = 界面顺序） */
export const EXPORT_SCALES: ExportScale[] = [1, 2, 3];

/** 导出恒用浅色版：画布底 / 图钉白底 / 墨色文字（:root 的 --foreground = 222 47% 11%） */
export const EXPORT_BG = '#f5f4f0';
export const EXPORT_INK = '#0f1729';
export const EXPORT_PIN_BG = '#ffffff';

/** 图钉与标签在**屏幕上**的尺寸（与 MapPinLayer 一致）；导出时 ÷s 折成世界像素 */
export const PIN_SCREEN_PX = 24;
export const PIN_ICON_SCREEN_PX = 14;
export const PIN_LABEL_SCREEN_PX = 10;
export const REGION_LABEL_SCREEN_PX = 11;

/** 光栅化上限：桌面浏览器 / 移动端壳（iOS 的 canvas 上限低得多） */
export const MAX_SIDE = 8192;
export const MAX_AREA = 40_000_000;
export const MOBILE_MAX_SIDE = 4096;
export const MOBILE_MAX_AREA = 16_000_000;

export interface ExportRect { x: number; y: number; w: number; h: number }
export interface ExportBox { w: number; h: number }

/** 屏幕上「1 个世界像素」等于几个 CSS 像素；视口还没量到尺寸时兜底成 1 */
export function screenScale(
  world: Size,
  toScreen: (nx: number, ny: number) => [number, number],
): number {
  const [x0] = toScreen(0, 0);
  const [x1] = toScreen(1, 0);
  const s = (x1 - x0) / world.w;
  return Number.isFinite(s) && s > 0 ? s : 1;
}

/**
 * 导出矩形（世界像素）。
 * full = 整张底图；viewport = 画布当前可见区 —— 允许超出底图边界，超出的部分
 * 就是画布底色，这样导出的图与屏幕上看到的完全一致（含四周留白）。
 */
export function exportRect(
  scope: ExportScope,
  world: Size,
  box: ExportBox,
  toScreen: (nx: number, ny: number) => [number, number],
): ExportRect {
  if (scope === 'full') return { x: 0, y: 0, w: world.w, h: world.h };
  const s = screenScale(world, toScreen);
  const [ox, oy] = toScreen(0, 0);
  return { x: -ox / s, y: -oy / s, w: box.w / s, h: box.h / s };
}

/**
 * 输出像素尺寸（四舍五入）。
 * 倍数的口径：**1 个世界像素 = 倍数个图片像素**（与屏幕缩放无关，也不乘
 * devicePixelRatio）—— 所以「整张底图 / 1×」导出的是底图原始像素，
 * 而「当前视口」导出的是可见区在世界坐标里的宽度 × 倍数。
 */
export function outputSize(rect: ExportRect, scale: ExportScale): ExportBox {
  return {
    w: Math.max(1, Math.round(rect.w * scale)),
    h: Math.max(1, Math.round(rect.h * scale)),
  };
}

export interface ScaleFit {
  /** 实际能用的倍数 */
  scale: ExportScale;
  /** 想要的倍数被降级了吗（要在状态行里说出来） */
  downgraded: boolean;
  maxSide: number;
  maxArea: number;
}

/**
 * 倍数夹取：超出 canvas 上限就往下找能用的最大整数档。
 * SVG 是矢量、名义尺寸不进内存，所以不夹（否则用户选 3× 会被莫名改掉）。
 */
export function fitScale(
  rect: ExportRect,
  want: ExportScale,
  format: ExportFormat,
  mobile: boolean,
): ScaleFit {
  const maxSide = mobile ? MOBILE_MAX_SIDE : MAX_SIDE;
  const maxArea = mobile ? MOBILE_MAX_AREA : MAX_AREA;
  const fits = (k: number) =>
    rect.w * k <= maxSide && rect.h * k <= maxSide && rect.w * k * rect.h * k <= maxArea;
  if (format === 'svg' || fits(want)) return { scale: want, downgraded: false, maxSide, maxArea };
  const lower = EXPORT_SCALES.filter((k) => k < want && fits(k));
  // 连 1× 都放不下时也返回 1×：由光栅化那一步如实报错，不硬凑一个假尺寸
  return { scale: lower.length ? lower[lower.length - 1] : 1, downgraded: true, maxSide, maxArea };
}

export function formatExt(format: ExportFormat): 'png' | 'jpg' | 'svg' {
  return format === 'jpeg' ? 'jpg' : format;
}

export function formatMime(format: ExportFormat): string {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'svg') return 'image/svg+xml';
  return 'image/png';
}

/** 文件名：`<地图名>-<范围>-<倍数>.<扩展名>`（非法字符换掉、空名回落 worldforge） */
export function exportFileName(
  mapName: string,
  scope: ExportScope,
  scale: ExportScale,
  format: ExportFormat,
): string {
  const tag = scope === 'viewport' ? '视口' : '全图';
  return `${safeFileName(mapName)}-${tag}-${scale}x.${formatExt(format)}`;
}
