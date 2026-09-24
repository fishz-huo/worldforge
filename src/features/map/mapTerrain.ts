/**
 * 地形符号：常量与数学（纯函数，有自测）
 * ==================================================================
 * 第三批「地形标记系统」。地形**不是新表**，而是复用 `map_pins` 的一种标记行：
 *   - `meta`   = `{ kind:'terrain', symbol, size, rotation }`（幂等加列的 JSON 列）
 *   - `icon`   = 符号键（`mountain`），`label` = 符号中文名（山脉）
 *   - `color`  = 该符号的默认色，用户可以改
 *   - `card_id` 恒为 null（地形不绑卡片），`note` 保持空串
 * 为什么复用而不是新建表：备份、快照、清库、删卡片解引用、版本恢复散在十几处，
 * 它们搬的都是**整行**；多一张表就要多改十几处（其中好几处在 store 与 db，
 * 本轮不许动），而复用之后那些路径一个字不改就自动带上地形。
 *
 * 这里只有常量与纯函数：meta 的读写与夹取、拖缩放手柄与旋转的换算。
 * 手势见 useTerrainGestures，渲染见 MapTerrainLayer / MapTerrainOverlay。
 */

/** meta.kind 的取值：用它把地形行与普通图钉区分开 */
export const TERRAIN_KIND = 'terrain';

/** 十个军事地图符号（键写进 meta，中文名写进 label） */
export type TerrainSymbol =
  | 'mountain'
  | 'hill'
  | 'forest'
  | 'river'
  | 'lake'
  | 'swamp'
  | 'desert'
  | 'grass'
  | 'walled'
  | 'pass';

export interface TerrainDef {
  key: TerrainSymbol;
  label: string;
  /** 落地时的默认颜色（河流湖泊用蓝、森林草原用绿、沙漠用土黄，其余用墨色） */
  color: string;
}

export const TERRAIN_SYMBOLS: TerrainDef[] = [
  { key: 'mountain', label: '山脉', color: '#334155' },
  { key: 'hill', label: '丘陵', color: '#334155' },
  { key: 'forest', label: '森林', color: '#15803d' },
  { key: 'river', label: '河流', color: '#2563eb' },
  { key: 'lake', label: '湖泊', color: '#2563eb' },
  { key: 'swamp', label: '沼泽', color: '#334155' },
  { key: 'desert', label: '沙漠', color: '#b45309' },
  { key: 'grass', label: '草原', color: '#4d7c0f' },
  { key: 'walled', label: '城池', color: '#334155' },
  { key: 'pass', label: '关隘', color: '#334155' },
];

const BY_KEY = new Map(TERRAIN_SYMBOLS.map((d) => [d.key, d]));

export function isTerrainSymbol(v: unknown): v is TerrainSymbol {
  return typeof v === 'string' && BY_KEY.has(v as TerrainSymbol);
}

/** 符号定义；认不出的一律回落成第一个（山脉）—— 手改过的 JSON 不该让符号消失 */
export function terrainDef(symbol: string | undefined): TerrainDef {
  return (symbol && BY_KEY.get(symbol as TerrainSymbol)) || TERRAIN_SYMBOLS[0];
}

/** size 的含义：底图宽度的倍数（1 = 底图宽的 6%），所以大小随底图尺寸走 */
export const TERRAIN_BASE_RATIO = 0.06;
export const TERRAIN_SIZE_MIN = 0.5;
export const TERRAIN_SIZE_MAX = 3;
/** 大小粒度：0.05 够用，又不至于拖一下写库几十次 */
export const TERRAIN_SIZE_STEP = 0.05;

/**
 * 地形的 meta 结构。
 * 写成 type 而不是 interface 是有意的：interface 没有隐式索引签名，
 * 赋给 `Record<string, unknown>`（MapPin.meta 的类型）会编译不过。
 */
export type TerrainMeta = {
  kind: typeof TERRAIN_KIND;
  symbol: TerrainSymbol;
  /** 底图宽的倍数，0.5~3 */
  size: number;
  /** 顺时针角度 0~359（0 = 正上方，与 CSS rotate 同向） */
  rotation: number;
};

/** 夹到 0.5~3 并对齐到 0.05（顺手抹掉浮点尾数，免得存出 1.1500000000000001） */
export function clampSize(v: number): number {
  if (!Number.isFinite(v)) return 1;
  const stepped = Math.round(v / TERRAIN_SIZE_STEP) * TERRAIN_SIZE_STEP;
  const clamped = Math.min(TERRAIN_SIZE_MAX, Math.max(TERRAIN_SIZE_MIN, stepped));
  return Math.round(clamped * 100) / 100;
}

/** 角度归一到 0~359 的整数度：负角、多绕几圈都收进一条线 */
export function normRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function makeTerrainMeta(symbol: TerrainSymbol, size = 1, rotation = 0): TerrainMeta {
  return { kind: TERRAIN_KIND, symbol, size: clampSize(size), rotation: normRotation(rotation) };
}

/** 读一条标记行的地形信息；不是地形（或 meta 坏了）返回 null */
export function readTerrain(pin: { meta?: Record<string, unknown> }): TerrainMeta | null {
  const meta = pin.meta;
  if (!meta || meta.kind !== TERRAIN_KIND || !isTerrainSymbol(meta.symbol)) return null;
  return makeTerrainMeta(meta.symbol, Number(meta.size ?? 1), Number(meta.rotation ?? 0));
}

/**
 * 这条标记行是不是地形。
 * 地形行**不参与**图钉的那套逻辑：计数、悬停浮窗、卡片绑定、图钉层渲染。
 */
export function isTerrainPin(pin: { meta?: Record<string, unknown> }): boolean {
  return readTerrain(pin) !== null;
}

/**
 * 指针相对中心的角度：0 = 正上方、顺时针增加，与 CSS `rotate()` 同向。
 * 旋转手柄就摆在符号正上方，所以「直接把手柄角度当旋转角」是连续的、
 * 不会在按下的那一瞬间跳一下。
 */
export function angleFrom(cx: number, cy: number, px: number, py: number): number {
  return normRotation((Math.atan2(px - cx, cy - py) * 180) / Math.PI);
}

/**
 * 拖缩放手柄：按「按下时的半径 → 当前半径」等比缩放。
 * 用比例而不是绝对距离，是因为手柄在**角上**：按下那一瞬的距离是
 * 对角线的一半（0.707×边长），直接拿去当半径会让符号先放大一截。
 * 半径基准兜一个 8px，手柄贴到中心时比例不会炸。
 */
export function scaleFromDrag(size0: number, radius0: number, radius: number): number {
  return clampSize((size0 * radius) / Math.max(radius0, 8));
}

/** 把符号本地的偏移（手柄位置）按旋转角转到世界坐标上 */
export function rotateOffset(dx: number, dy: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [dx * cos - dy * sin, dx * sin + dy * cos];
}
