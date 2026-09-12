/**
 * ID 生成
 * ------------------------------------------------------------------
 * 采用「时间前缀 + 随机后缀」的 12 位短 ID：
 *  - 短：适合出现在 URL、导出文件与手写链接里；
 *  - 有序：前缀是 base36 时间戳，天然按创建时间排序；
 *  - 无依赖：不引入 uuid 包，保持产物体积。
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** 把数字转成 base36 定长字符串 */
function toBase36(num: number, pad: number): string {
  let out = '';
  let n = Math.floor(num);
  while (n > 0) {
    out = ALPHABET[n % 36] + out;
    n = Math.floor(n / 36);
  }
  return out.padStart(pad, '0');
}

/**
 * 生成短 ID，例如 `m1x2y3z4a5b6`
 * @param prefix 可选语义前缀（c=卡片、w=世界、b=分支、m=地图…），便于调试排查
 */
export function newId(prefix = ''): string {
  const time = toBase36(Date.now(), 8);
  const rand = toBase36(Math.floor(Math.random() * 36 ** 4), 4);
  return `${prefix}${time}${rand}`;
}

/** 常用前缀常量，避免各处硬编码 */
export const ID_PREFIX = {
  world: 'w',
  branch: 'b',
  card: 'c',
  tag: 't',
  relation: 'r',
  map: 'm',
  pin: 'p',
  region: 'g',
  track: 'k',
  entry: 'e',
  era: 'a',
  doc: 'd',
  outline: 'o',
  version: 'v',
  asset: 'f',
  plugin: 'x',
} as const;

/** 语义化生成器集合 */
export const newWorldId = () => newId(ID_PREFIX.world);
export const newBranchId = () => newId(ID_PREFIX.branch);
export const newCardId = () => newId(ID_PREFIX.card);
export const newTagId = () => newId(ID_PREFIX.tag);
export const newRelationId = () => newId(ID_PREFIX.relation);
export const newMapId = () => newId(ID_PREFIX.map);
export const newPinId = () => newId(ID_PREFIX.pin);
export const newRegionId = () => newId(ID_PREFIX.region);
export const newTrackId = () => newId(ID_PREFIX.track);
export const newEntryId = () => newId(ID_PREFIX.entry);
export const newEraId = () => newId(ID_PREFIX.era);
export const newDocId = () => newId(ID_PREFIX.doc);
export const newOutlineId = () => newId(ID_PREFIX.outline);
export const newVersionId = () => newId(ID_PREFIX.version);
export const newAssetId = () => newId(ID_PREFIX.asset);
export const newPluginId = () => newId(ID_PREFIX.plugin);
