/**
 * 区域编辑的数学（纯函数，有自测）
 * ==================================================================
 * 第三轮的「区域整体移动」与「边缘加顶点」都只跟顶点数组打交道，抽出来是为了
 * 能逐条验算 —— 这两件事算错都不报错，只是"看着别扭"：
 *   - 整体移动的位移必须按**整个包围盒**夹取：逐点夹会把区域压扁变形，
 *     完全不夹又会把区域拖到 0~1 之外（底图外面的留白里）。
 *   - 新顶点必须插在**最近那条边的起点之后**：追加到末尾等于只把最后一条边
 *     拆成两条、其它边原地不动，多边形会自交。
 * 命中判定用**屏幕像素**（调用方先把顶点换算成 rect 内的像素）：归一化空间是
 * 各向异性的（x 乘宽、y 乘高），在那里量距离会横竖不一致。
 */

/** 二元组：归一化坐标或像素坐标，含义由调用方决定 */
export type Point = [number, number];

export interface EdgeHit {
  /** 边的序号：第 i 条边 = points[i] → points[i + 1]（最后一条绕回 0） */
  index: number;
  /** 命中点在边上的参数 0~1 */
  t: number;
  /** 到这条边的距离（与传入坐标同单位） */
  dist: number;
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/** 顶点包围盒 */
export function bbox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * 把「整体位移」夹在 0~1 之内：按包围盒算，不逐点算。
 * 一旦某个点先顶到边界，其余点必须一起停，否则形状就变了 ——
 * 用户要的是「整体平移」，不是「挤到边上再变形」。
 */
export function clampShift(points: Point[], dx: number, dy: number): Point {
  if (points.length === 0) return [0, 0];
  const b = bbox(points);
  return [clamp(dx, -b.minX, 1 - b.maxX), clamp(dy, -b.minY, 1 - b.maxY)];
}

/** 所有顶点同步偏移（形状不变） */
export function shiftPoints(points: Point[], dx: number, dy: number): Point[] {
  return points.map(([x, y]) => [x + dx, y + dy] as Point);
}

/** 归一化顶点 → 画布 rect 内的像素（命中判定用） */
export function pointsToScreen(points: Point[], width: number, height: number): Point[] {
  return points.map(([x, y]) => [x * width, y * height] as Point);
}

/** 点到线段的最短距离，以及投影参数 t（夹在 0~1，退化线段取端点） */
export function pointSegDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return { dist: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

/** 光标到多边形各边的最短距离；超过 maxDist 当作没命中 */
export function nearestEdge(screen: Point[], px: number, py: number, maxDist: number): EdgeHit | null {
  if (screen.length < 3) return null;
  let best: EdgeHit | null = null;
  for (let i = 0; i < screen.length; i += 1) {
    const [ax, ay] = screen[i];
    const [bx, by] = screen[(i + 1) % screen.length];
    const { dist, t } = pointSegDistance(px, py, ax, ay, bx, by);
    if (dist > maxDist) continue;
    if (!best || dist < best.dist) best = { index: i, t, dist };
  }
  return best;
}

/** 命中处的归一化坐标：在 points[index] → points[index+1] 之间按 t 取点 */
export function hitPoint(points: Point[], hit: EdgeHit): Point {
  const [ax, ay] = points[hit.index];
  const [bx, by] = points[(hit.index + 1) % points.length];
  return [ax + (bx - ax) * hit.t, ay + (by - ay) * hit.t];
}

/** 在命中边的起点之后插一个顶点（见文件头：追加到末尾会让多边形自交） */
export function insertVertex(points: Point[], hit: EdgeHit, point: Point): Point[] {
  const next = points.slice();
  next.splice(hit.index + 1, 0, point);
  return next;
}

/** 加顶点的完整一步：算出落点并插到最近那条边上 */
export function insertOnEdge(points: Point[], hit: EdgeHit): Point[] {
  return insertVertex(points, hit, hitPoint(points, hit));
}

/* ------------------- 拉框建区域（2026-09-26 问题二） ------------------- */

/** 拉框建区域的最小边长（归一化）：小于它不建，免得留下一根线 */
export const MIN_DRAW_SIZE = 0.01;

/**
 * 拖出来的两个对角点 → 四个顶点。
 * 顺序固定为「左上 → 右上 → 右下 → 左下」，与拖动方向无关：从右下往左上拖，
 * 得到的顶点序列与反向拖完全一样（下游只关心形状，方向不影响填充与命中）。
 */
export function rectPolygon(a: Point, b: Point): Point[] {
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const y1 = Math.max(a[1], b[1]);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** 这个矩形够不够大（两条边都要过 MIN_DRAW_SIZE，等于阈值算够） */
export function rectDrawable(a: Point, b: Point): boolean {
  return Math.abs(a[0] - b[0]) >= MIN_DRAW_SIZE && Math.abs(a[1] - b[1]) >= MIN_DRAW_SIZE;
}
