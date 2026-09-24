/**
 * 地图视口：缩放与平移的数学
 * ==================================================================
 * 为什么单独一个纯函数文件：视口算错的表现是「看着有点别扭」而不是报错 ——
 * 滚轮放大后光标指着的位置跑掉了、拖到边界露出空白、「适应屏幕」之后图还是
 * 偏的。这些用肉眼很难验收，所以把数学抽出来交给
 * scripts/map-viewport-selftest.mjs 逐条验（附带 14 项断言）。
 *
 * 坐标系统（三层，换算只在这一个文件里）：
 *   归一化 0~1（数据库里存的就是它：map_pins.x/y、区域顶点、时间轴无关）
 *     → 世界坐标 = 归一化 × 底图原始像素尺寸（world）
 *       → 屏幕坐标（相对视口窗口左上角）= 世界坐标 × scale + (tx, ty)
 *
 * scale 的单位是「屏幕像素 / 底图原始像素」，两个方向共用同一个 scale，
 * 所以底图不会被拉变形 —— 这正是「世界盒按底图长宽比」的落地方式：
 * 窗口比底图更扁时，留白出现在左右，出现在上下则由 ty 决定，都是居中。
 */

/** 视口状态：把世界坐标映射到屏幕坐标的三个数 */
export interface MapViewport {
  /** 屏幕像素 / 底图原始像素 */
  scale: number;
  /** 世界原点在屏幕上的位置 */
  tx: number;
  ty: number;
}

/** 一个宽高（窗口尺寸、底图尺寸共用） */
export interface Size {
  w: number;
  h: number;
}

/** 最大放大倍数（相对「适应屏幕」，即 100% → 600%） */
export const MAX_ZOOM = 6;
/** 按钮/滚轮的每次缩放步长 */
export const ZOOM_STEP = 1.25;
/** 没有底图、或底图没记尺寸时的世界盒（4:3），保证照样能缩放平移 */
export const DEFAULT_WORLD: Size = { w: 1600, h: 1200 };

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** 尺寸可用（正数、有限） */
function usable(s: Size | null | undefined): s is Size {
  return Boolean(s && Number.isFinite(s.w) && Number.isFinite(s.h) && s.w > 0 && s.h > 0);
}

/**
 * 底图的世界尺寸：优先用资源表里记的真实像素，其次用 <img> 实测到的，
 * 都没有就退回 4:3 默认盒（老底图可能没记尺寸，不能因此白屏）。
 */
export function resolveWorldSize(
  asset: { width?: number; height?: number } | null | undefined,
  measured: Size | null,
): Size {
  const fromAsset: Size | null =
    asset && Number(asset.width) > 0 && Number(asset.height) > 0
      ? { w: Number(asset.width), h: Number(asset.height) }
      : null;
  if (usable(fromAsset)) return fromAsset;
  if (usable(measured)) return measured;
  return { ...DEFAULT_WORLD };
}

/** 「适应屏幕」时的 scale：整张底图刚好塞进窗口（两个方向取小的那个） */
export function fitScale(box: Size, world: Size): number {
  if (!usable(box) || !usable(world)) return 1;
  return Math.min(box.w / world.w, box.h / world.h);
}

/** 缩放上下限：下限就是「适应屏幕」（缩不出空白），上限 6 倍 */
export function zoomBounds(box: Size, world: Size): { min: number; max: number } {
  const min = fitScale(box, world);
  return { min, max: min * MAX_ZOOM };
}

/** 适应屏幕：整张图完整可见并居中 */
export function fitViewport(box: Size, world: Size): MapViewport {
  if (!usable(box) || !usable(world)) return { scale: 1, tx: 0, ty: 0 };
  const scale = fitScale(box, world);
  return { scale, tx: (box.w - world.w * scale) / 2, ty: (box.h - world.h * scale) / 2 };
}

/**
 * 把视口夹回合法范围：
 *   - scale 夹进 [适应屏幕, 6 倍]；若因此变了 scale，就**按住窗口中心**换算
 *     tx/ty（窗口改大改小时，用户正看着的中心不会跳走）；
 *   - 底图比窗口大：不许拖出空白（tx ∈ [box.w - 世界宽, 0]）；
 *   - 底图比窗口小（留白那一轴）：强制居中，拖不动。
 */
export function clampViewport(vp: MapViewport, box: Size, world: Size): MapViewport {
  if (!usable(box) || !usable(world)) return vp;
  const { min, max } = zoomBounds(box, world);
  const scale = clamp(Number.isFinite(vp.scale) && vp.scale > 0 ? vp.scale : min, min, max);
  const k = scale / (vp.scale > 0 ? vp.scale : scale);
  const cx = box.w / 2;
  const cy = box.h / 2;
  const tx0 = cx - (cx - vp.tx) * k;
  const ty0 = cy - (cy - vp.ty) * k;

  const sw = world.w * scale;
  const sh = world.h * scale;
  const tx = sw <= box.w ? (box.w - sw) / 2 : clamp(tx0, box.w - sw, 0);
  const ty = sh <= box.h ? (box.h - sh) / 2 : clamp(ty0, box.h - sh, 0);
  return { scale, tx, ty };
}

/**
 * 以某个屏幕点为锚点缩放（滚轮/按钮共用）。
 * 锚点下的那个世界点保持不动 —— 这就是"像 Google 地图"的关键手感。
 */
export function zoomAt(
  vp: MapViewport,
  factor: number,
  anchorX: number,
  anchorY: number,
  box: Size,
  world: Size,
): MapViewport {
  if (!usable(box) || !usable(world) || !Number.isFinite(factor) || factor <= 0) return vp;
  const base = vp.scale > 0 ? vp.scale : fitScale(box, world);
  const { min, max } = zoomBounds(box, world);
  const next = clamp(base * factor, min, max);
  const wx = (anchorX - vp.tx) / base;
  const wy = (anchorY - vp.ty) / base;
  return clampViewport({ scale: next, tx: anchorX - wx * next, ty: anchorY - wy * next }, box, world);
}

/** 按屏幕位移平移（拖拽用） */
export function panBy(vp: MapViewport, dx: number, dy: number, box: Size, world: Size): MapViewport {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return vp;
  return clampViewport({ ...vp, tx: vp.tx + dx, ty: vp.ty + dy }, box, world);
}

/** 归一化坐标 → 视口窗口内的像素位置（区域名称与顶点手柄画在屏幕空间用） */
export function toScreen(vp: MapViewport, nx: number, ny: number, world: Size): [number, number] {
  return [nx * world.w * vp.scale + vp.tx, ny * world.h * vp.scale + vp.ty];
}

/** 显示用的百分比：100% = 适应屏幕 */
export function zoomPercent(vp: MapViewport, fit: number): number {
  if (!Number.isFinite(fit) || fit <= 0 || !Number.isFinite(vp.scale)) return 100;
  return Math.round((vp.scale / fit) * 100);
}

/**
 * 滚轮位移 → 缩放倍率。
 * 用指数而不是"一格一个固定倍数"：鼠标滚轮一格 deltaY≈±100（得到约 ±16%），
 * 触控板是连续小值（得到连续小步），两者手感都对；再夹到 [0.5, 2]，
 * 免得某些设备一次丢一个巨大的 deltaY 把图瞬移。
 */
export function wheelFactor(deltaY: number): number {
  if (!Number.isFinite(deltaY)) return 1;
  return clamp(Math.exp(-deltaY * 0.0015), 0.5, 2);
}
