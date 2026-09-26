/**
 * 框选候选：把地图数据投影成屏幕几何（纯函数，有自测）
 * ==================================================================
 * 从 mapMarquee 分出来的一半：那边管「框的方向语义与命中判定」，这边管
 * 「对象在屏幕上长什么样」。分开的理由很实在 —— 投影规则要引用地图既有的
 * 常量与 rotateOffset，而命中判定是纯几何，混在一个文件里会顶到 200 行。
 *
 * 坐标一律用**客户端像素**（与 getBoundingClientRect 同源）：缩放、平移、
 * 滚动都已经被视口算进那个矩形里了，这里不必再算一遍。
 */
import type { MapPin, MapRegion } from '@/types';
import { TERRAIN_BASE_RATIO, readTerrain, rotateOffset } from './mapTerrain';
import type { MapSelectionItem } from './mapSelection';

/** 标记点的屏幕命中盒：与 MapPinLayer 的 size-6（24px）一致 */
export const PIN_HIT_SIZE = 24;

/** 世界层此刻的屏幕矩形（getBoundingClientRect 的四项就够） */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 候选对象：屏幕空间的多边形（标记与地形是 4 个角，区域是整串顶点） */
export interface MarqueeCandidate extends MapSelectionItem {
  points: [number, number][];
}

/** 中心 + 宽高 + 旋转角 → 四角（顺时针，与 CSS rotate 同向，复用 rotateOffset） */
export function rectPoints(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation = 0,
): [number, number][] {
  const hx = w / 2;
  const hy = h / 2;
  return ([[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]] as [number, number][]).map(([dx, dy]) => {
    const [rx, ry] = rotateOffset(dx, dy, rotation);
    return [cx + rx, cy + ry];
  });
}

/**
 * 地图数据 → 屏幕候选几何。
 * 标记 24px 方盒（屏幕上恒定，与 --wf-map-inv-scale 的做法一致）；
 * 地形是「随底图缩放的正方形转 meta.rotation 度」（边长 = 底图宽的 6% × size）；
 * 区域是整串归一化顶点按世界层矩形投影。
 */
export function buildCandidates(
  rect: RectLike,
  pins: MapPin[],
  terrain: MapPin[],
  regions: MapRegion[],
): MarqueeCandidate[] {
  const sx = (nx: number) => rect.left + nx * rect.width;
  const sy = (ny: number) => rect.top + ny * rect.height;
  const out: MarqueeCandidate[] = [];
  for (const pin of pins) {
    out.push({ kind: 'pin', id: pin.id, points: rectPoints(sx(pin.x), sy(pin.y), PIN_HIT_SIZE, PIN_HIT_SIZE) });
  }
  for (const pin of terrain) {
    const meta = readTerrain(pin);
    if (!meta) continue; // 手改过的 JSON：宁可漏一个，也别按奇怪的形状命中
    const side = TERRAIN_BASE_RATIO * meta.size * rect.width;
    out.push({ kind: 'terrain', id: pin.id, points: rectPoints(sx(pin.x), sy(pin.y), side, side, meta.rotation) });
  }
  for (const region of regions) {
    out.push({ kind: 'region', id: region.id, points: region.points.map(([x, y]) => [sx(x), sy(y)]) });
  }
  return out;
}

/**
 * 落点防重叠（2026-09-26 问题三）：离这个落点最近的已有标记，没有就 null。
 * 打点常驻之后，同一点上连点两下会叠出第二个**完全看不见**的标记（24px 圆完全重合），
 * 所以落点前先问它：中心距小于半个命中盒（12px）就当作"点在同一个地方"，
 * 改为选中已有那个，不再落新的。
 */
export function pinNear(pins: MapPin[], rect: RectLike, x: number, y: number): MapPin | null {
  const px = rect.left + x * rect.width;
  const py = rect.top + y * rect.height;
  let best: MapPin | null = null;
  let bestDist = PIN_HIT_SIZE / 2;
  for (const pin of pins) {
    const d = Math.hypot(rect.left + pin.x * rect.width - px, rect.top + pin.y * rect.height - py);
    if (d <= bestDist) {
      best = pin;
      bestDist = d;
    }
  }
  return best;
}
