/**
 * 从**实时 DOM** 取图标，改写成能嵌进导出 SVG 的片段
 * ==================================================================
 * 为什么从 DOM 取而不是复制一份 path 表（用户拍板方案 A）：图形只有一份真相 ——
 * 以后换 TerrainGlyph 的画法、或换图钉的 lucide 图标，导出自动跟着变，不会出现
 * 「屏幕上是新的、导出还是旧的」。用到的 DOM 契约是既有的稳定属性：
 *   `[data-wf-map-pin="<id>"]` / `[data-wf-map-terrain="<id>"]`（第三批建立，
 *   命中判定与手势都靠它们）。
 *
 * 只做搬运：读根 svg 的 viewBox / 呈现属性与它的 innerHTML。**丢掉 class**：
 * Tailwind 类在「SVG 当图片」渲染时不生效，尺寸与颜色由上层按世界像素与
 * pin.color 重新给。这里的东西都碰 DOM，所以不写单测（可测的在 mapExportSvg）。
 */
export interface GlyphMarkup {
  viewBox: string;
  /** 根 svg 上的呈现属性（stroke / stroke-width / fill …），原样搬运 */
  attrs: string;
  inner: string;
}

/** 需要跟着搬的属性：lucide 的线宽/线帽写在根 svg 上，子元素只继承 */
const COPY_ATTRS = [
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-opacity', 'fill-rule', 'clip-rule',
];

function markupOf(svg: SVGSVGElement): GlyphMarkup {
  const attrs = COPY_ATTRS.map((a) => {
    const v = svg.getAttribute(a);
    return v ? ` ${a}="${v}"` : '';
  }).join('');
  return { viewBox: svg.getAttribute('viewBox') ?? '0 0 24 24', attrs, inner: svg.innerHTML };
}

/** 取一个元素的图标：attr 是稳定契约属性名（见文件头） */
export function glyphFor(attr: string, id: string): GlyphMarkup | null {
  const host = document.querySelector(`[${attr}="${CSS.escape(id)}"]`);
  const svg = host?.querySelector('svg');
  return svg instanceof SVGSVGElement ? markupOf(svg) : null;
}

/** 批量取：返回命中表与**没取到的 id**（后者要在状态行里如实说，不能静默少画） */
export function collectGlyphs(
  attr: string,
  ids: string[],
): { hits: Record<string, GlyphMarkup>; missing: string[] } {
  const hits: Record<string, GlyphMarkup> = {};
  const missing: string[] = [];
  ids.forEach((id) => {
    const m = glyphFor(attr, id);
    if (m) hits[id] = m;
    else missing.push(id);
  });
  return { hits, missing };
}

/**
 * 画布可见区的像素尺寸。
 * 视口的 toScreenPixel 是相对**画布**的，而画布元素只能从世界层
 * （`data-wf-map-world`）的父节点拿到 —— 为了导出给 MapCanvas 加属性不值得
 * （本轮约定它一行不动）。量不到返回 null，由调用方提示，不猜一个尺寸。
 */
export function canvasBoxSize(): { w: number; h: number } | null {
  const world = document.querySelector('[data-wf-map-world]');
  const box = world?.parentElement;
  if (!box) return null;
  const w = box.clientWidth;
  const h = box.clientHeight;
  return w > 0 && h > 0 ? { w, h } : null;
}
