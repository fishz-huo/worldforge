/**
 * 把地图拼成一份「导出专用 SVG」字符串（纯函数，有自测）
 * ==================================================================
 * 为什么不去序列化界面 DOM（foreignObject 那条路）：Tailwind 类在「SVG 当图片」
 * 渲染时不生效、CSS 变量要手工解析，而且**外部资源一律不加载** —— 底图是 blob:
 * objectURL，那样会得到一张没有底图的图（不报错，最难查）。所以这里从数据现拼：
 *   底图 → `<image href="data:…">`（必须内联，取图见 mapExportImage）
 *   区域 → 与 mapRender.regionPath 同一套坐标，只是换成世界像素
 *   地形 → 世界宽的 6% × size（`TERRAIN_BASE_RATIO`），绕中心 rotate
 *   图钉 → 白底圆 + 图标（图标从实时 DOM 取，见 mapGlyphSvg）
 * **不画**的东西（plan §3）：网格、选中虚线、顶点/旋转手柄、悬停高亮。
 * 屏幕空间固定尺寸（图钉 24px、图标 14px、描边 1px、字号）一律 ÷s 折成世界像素。
 */
import type { MapPin, MapRegion } from '@/types';
import { centroid } from '@/types';
import { escapeHtml } from '@/lib/markdown/inline';
import { regionFill, regionStroke } from './mapRender';
import { TERRAIN_BASE_RATIO, readTerrain } from './mapTerrain';
import {
  EXPORT_BG, EXPORT_INK, EXPORT_PIN_BG, PIN_ICON_SCREEN_PX, PIN_LABEL_SCREEN_PX,
  PIN_SCREEN_PX, REGION_LABEL_SCREEN_PX, outputSize,
} from './mapExportRect';
import type { ExportRect, ExportScale, RegionMode } from './mapExportRect';
import type { GlyphMarkup } from './mapGlyphSvg';
import type { Size } from './mapViewport';

/** 与 tailwind.config.js 的 fontFamily.sans 一致（SVG 当图片时只有本机字体可用） */
const FONT = "Inter, system-ui, 'Noto Sans SC', 'Microsoft YaHei', sans-serif";
/** 区域名沿用屏幕上的观感：浅色字 + 深色描边（见 MapRegionOverlay） */
const REGION_LABEL = '#e2e8f0';
const REGION_HALO = '#0b1220';

export interface ExportBackdrop {
  /** 必须是 data: URL —— blob:/http: 在「SVG 当图片」时不会被加载 */
  href: string;
  opacity: number;
}

export interface ExportScene {
  rect: ExportRect;
  world: Size;
  /** 屏幕上 1 世界像素 = s 个 CSS 像素（屏幕空间尺寸 ÷s 折成世界像素） */
  s: number;
  k: ExportScale;
  backdrop: ExportBackdrop | null;
  regions: MapRegion[];
  regionMode: RegionMode;
  metric: string;
  maxValue: number;
  showLabels: boolean;
  terrain: MapPin[];
  pins: MapPin[];
  pinGlyphs: Record<string, GlyphMarkup>;
  terrainGlyphs: Record<string, GlyphMarkup>;
}

const num = (v: number) => Number(v.toFixed(2));

/** 归一化顶点 → 世界像素的多边形路径（不做非等比 scale：描边会被拉扁） */
function worldPath(region: MapRegion, world: Size): string {
  const pts = region.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${num(x * world.w)} ${num(y * world.h)}`);
  return `${pts.join(' ')} Z`;
}

/** 图标片段：图形来自实时 DOM，尺寸与颜色由这里按世界像素给 */
function icon(glyph: GlyphMarkup | undefined, x: number, y: number, size: number, color: string): string {
  if (!glyph) return '';
  const box = `x="${num(x)}" y="${num(y)}" width="${num(size)}" height="${num(size)}"`;
  return `<svg ${box} viewBox="${glyph.viewBox}"${glyph.attrs} color="${color}">${glyph.inner}</svg>`;
}

/** 文字：描边当"光晕"（SVG 里没有 text-shadow，用 paint-order 让描边垫在字下） */
function text(
  content: string, x: number, y: number, size: number,
  color: string, halo: string, centered: boolean,
): string {
  const anchor = centered ? ' text-anchor="middle" dominant-baseline="middle"' : ' text-anchor="middle"';
  return `<text x="${num(x)}" y="${num(y)}"${anchor} font-family="${FONT}" font-size="${num(size)}"`
    + ` fill="${color}" stroke="${halo}" stroke-width="${num(size * 0.28)}" paint-order="stroke">`
    + `${escapeHtml(content)}</text>`;
}

function backdropLayer(scene: ExportScene): string {
  const b = scene.backdrop;
  if (!b) return '';
  const box = `x="0" y="0" width="${scene.world.w}" height="${scene.world.h}"`;
  return `<image ${box} preserveAspectRatio="none" opacity="${b.opacity}" href="${b.href}" xlink:href="${b.href}" />`;
}

function regionLayer(scene: ExportScene): string {
  return scene.regions.map((r) => {
    const st = regionStroke(r, false);
    const fill = regionFill(r, scene.regionMode, scene.metric, scene.maxValue);
    const stroke = `stroke="${st.color}" stroke-width="${num(st.width / scene.s)}" stroke-opacity="${st.opacity}"`;
    return `<path d="${worldPath(r, scene.world)}" fill="${fill}" ${stroke} />`;
  }).join('');
}

function terrainLayer(scene: ExportScene): string {
  return scene.terrain.map((pin) => {
    const meta = readTerrain(pin);
    if (!meta) return '';
    const size = TERRAIN_BASE_RATIO * scene.world.w * meta.size;
    const cx = pin.x * scene.world.w;
    const cy = pin.y * scene.world.h;
    // 与 MapTerrainLayer 同一套 transform：居中 → 旋转 → 回到左上角
    const move = `translate(${num(cx)} ${num(cy)}) rotate(${meta.rotation}) translate(${num(-size / 2)} ${num(-size / 2)})`;
    return `<g transform="${move}">${icon(scene.terrainGlyphs[pin.id], 0, 0, size, pin.color)}</g>`;
  }).join('');
}

function pinLayer(scene: ExportScene): string {
  const r = PIN_SCREEN_PX / 2 / scene.s;
  const iconSize = PIN_ICON_SCREEN_PX / scene.s;
  const labelSize = PIN_LABEL_SCREEN_PX / scene.s;
  return scene.pins.map((pin) => {
    const cx = pin.x * scene.world.w;
    const cy = pin.y * scene.world.h;
    const disc = `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${EXPORT_PIN_BG}"`
      + ` stroke="${pin.color}" stroke-width="${num(1.5 / scene.s)}" />`;
    const glyph = icon(scene.pinGlyphs[pin.id], cx - iconSize / 2, cy - iconSize / 2, iconSize, EXPORT_INK);
    const label = scene.showLabels && pin.label
      ? text(pin.label, cx, cy + r + labelSize * 1.2, labelSize, EXPORT_INK, EXPORT_PIN_BG, false)
      : '';
    return disc + glyph + label;
  }).join('');
}

function regionLabelLayer(scene: ExportScene): string {
  if (!scene.showLabels) return '';
  const size = REGION_LABEL_SCREEN_PX / scene.s;
  return scene.regions.map((r) => {
    if (!r.name) return '';
    const [nx, ny] = centroid(r.points);
    return text(r.name, nx * scene.world.w, ny * scene.world.h, size, REGION_LABEL, REGION_HALO, true);
  }).join('');
}

/** 拼出完整的 SVG 文档字符串（PNG/JPG 交给光栅化，SVG 格式直接存这一份） */
export function buildExportSvg(scene: ExportScene): string {
  const { x, y, w, h } = scene.rect;
  const size = outputSize(scene.rect, scene.k);
  const viewBox = `${num(x)} ${num(y)} ${num(w)} ${num(h)}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`
      + ` width="${size.w}" height="${size.h}" viewBox="${viewBox}">`,
    `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${EXPORT_BG}" />`,
    backdropLayer(scene),
    regionLayer(scene),
    terrainLayer(scene),
    pinLayer(scene),
    regionLabelLayer(scene),
    '</svg>',
  ].join('');
}
