/**
 * 卡片属性区 · 值的排版与转义
 * ==================================================================
 * 属性区要同时满足三个要求：人能读懂、能原样解析回来、拿出去别的工具也认。
 * 所以值一律按 YAML 标量的规矩写：
 *   - 干净的值裸写（`第 7 年`、`-7`、`true`）；
 *   - 含特殊字符（冒号 / `#` / `[[` / 前后空格 / 空串）的加双引号并转义；
 *   - 数组写成 `[a, b]`，元素各自按标量规则处理。
 *
 * 数字与布尔必须保持类型：刻度 -7 读回来要是数字，不能变成字符串 "-7"，
 * 否则时间轴与年龄推算会因为字符串比较而出错。
 */
import type { FieldValue, Relation } from '@/types';

/** 需要加引号的形态：特殊开头、特殊字符、能当数字/布尔/null 解读的文本 */
const NEEDS_QUOTE = /[:#,[\]{}"'\n\r\t]|^\s|\s$|^$|^(true|false|null|~)$|^-?\d+(\.\d+)?$/i;

/** 需要加引号的键名（YAML 里带冒号的键会歧义） */
export const VALID_KEY = /^[\w\u4e00-\u9fa5][\w\u4e00-\u9fa5-]*$/;

/** 双引号字符串的字面量转义 */
function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/** 单个标量值 → YAML 标量文本 */
export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '""';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value);
  return NEEDS_QUOTE.test(text) ? quote(text) : text;
}

/**
 * 字段值 → 文本。
 * key 用来判断类型：数值型字段（刻度、人口…）即使值存成了字符串也要按数字写出去，
 * 这样回读时能拿回数字。
 */
export function formatFieldValue(value: FieldValue | unknown, key?: string): string {
  if (Array.isArray(value)) return `[${value.map((v) => formatScalar(v)).join(', ')}]`;
  if (isNumericKey(key) && value !== '' && value !== null && value !== undefined) {
    const n = Number(value);
    if (Number.isFinite(n)) return String(n);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return formatScalar(value as unknown);
}

/**
 * 数值型字段的键名。
 * 与 sample 手册里的 NUMERIC_KEYS 是同一批：刻度与计数类字段。
 */
const NUMERIC_KEYS = new Set([
  'birth_t', 'death_t', 'start_t', 'end_t', 'founded_t', 'dissolved_t',
  'population', 'agriculture', 'mineral', 'military', 'trade',
]);

/** 是否数值型字段（名字带 _t 的刻度字段一律算） */
export function isNumericKey(key?: string): boolean {
  if (!key) return false;
  return NUMERIC_KEYS.has(key) || /_t$/.test(key);
}

/** 解析用的标题索引：id → 卡片标题 */
export type TitleOf = (id: string) => string;

/**
 * 一条关联 → 属性区里的一行文本。
 *
 * 方向用箭头区分（→ 出边 / ← 入边 / ↔ 无向），这是用户一眼能看懂、
 * 又能被正则稳稳切开的写法。
 *
 * 行尾附上对端卡片的 id（`[[card-xxx]]`）：双链 `[[标题]]` 在标题改动后会断，
 * 而 id 是稳定的。id 是给机器看的，人能忽略它 —— 因此这一行既能被正确解析，
 * 又不会在标题重名 / 改名后指错卡片。
 */
export function relationLine(rel: Relation, selfId: string, titleOf: TitleOf): string {
  const outgoing = rel.from_id === selfId;
  const otherId = outgoing ? rel.to_id : rel.from_id;
  const arrow = rel.directed === 0 ? '↔' : outgoing ? '→' : '←';
  const label = rel.label || '关联';
  const title = titleOf(otherId) || '（已删除的卡片）';
  const note = rel.note ? `（${rel.note}）` : '';
  return `${arrow} ${label}：${title}${note} [[${otherId}]]`;
}

/** 一组关联 → 行数组（按关系名排序，保证两次渲染结果一致） */
export function joinRelations(relations: Relation[], selfId: string, titleOf: TitleOf): string[] {
  return relations
    .map((rel) => relationLine(rel, selfId, titleOf))
    .sort((a, b) => a.localeCompare(b, 'zh'));
}
