/**
 * 地图上的自定义光标（区域边缘「+」与顶点「−」）
 * ==================================================================
 * 浏览器没有现成的「加号 / 减号」光标（crosshair 是十字、copy 是箭头带加号，
 * 与顶点手柄的观感都不搭），所以用内联 data-URI 的 SVG 自己画。
 * 两个注意点：
 *   1. 图形只用 path，不写文字 —— 文字要靠字体，光标里的文字可能渲染成方框；
 *   2. 整个 SVG 走 encodeURIComponent，`#` 会被编码成 %23，否则颜色会把
 *      data-URI 截断（这是 data-URI 光标最常见的坑）。
 * 尺寸 24×24、热点取正中（12 12）：光标中心就是插入点，看到哪就点到哪。
 */
import type { MapTool } from '@/types';

const svg = (path: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
  '<circle cx="12" cy="12" r="9" fill="#ffffff" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>' +
  `<path d="${path}" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/></svg>`;

const cursor = (path: string, fallback: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg(path))}") 12 12, ${fallback}`;

/** 悬停选中区域的边缘：Ctrl/⌘ + 点击在这里加一个顶点 */
export const CURSOR_ADD_VERTEX = cursor('M12 7v10M7 12h10', 'cell');

/** 按住 Alt 悬停顶点：点击删掉这个顶点 */
export const CURSOR_REMOVE_VERTEX = cursor('M7 12h10', 'not-allowed');

/** 只剩 3 个顶点时按 Alt：删不了，直接给禁止光标 */
export const CURSOR_REMOVE_BLOCKED = 'not-allowed';

/**
 * 画布光标（Tailwind class）：拖拽中 = grabbing；平移态 / 预览 = grab；打点 = crosshair。
 * 边缘热区的「+」不走类名（见上），它用 inline style，优先级高于 class。
 */
export function mapCursorClass(opts: {
  panning: boolean;
  panMode: boolean;
  preview: boolean;
  tool: MapTool;
}): string {
  if (opts.panning) return 'cursor-grabbing';
  if (opts.panMode || opts.preview) return 'cursor-grab';
  return opts.tool === 'pin' ? 'cursor-crosshair' : 'cursor-default';
}
