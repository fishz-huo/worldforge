/**
 * 全局通用类型
 * ------------------------------------------------------------------
 * 这里只放与具体业务无关的原子类型，供其它类型文件复用。
 */

/** 实体主键：统一使用 12 位短 ID（见 lib/id.ts），便于阅读与手写链接 */
export type Id = string;

/** 时间戳：毫秒级 Unix 时间 */
export type Timestamp = number;

/** 数据库中的 JSON 文本列（仓储层会自动 parse / stringify） */
export type JsonText = string;

/** 可序列化的任意值，用于 meta 等开放字段 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** 结构化对象的通用键值包 */
export type JsonRecord = Record<string, JsonValue>;

/** 卡片 / 地图等实体的差异化字段值 */
export type FieldValue = string | number | boolean | null | string[] | undefined;

/** 一张实体共有的时间戳字段 */
export interface Stamps {
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** 排序方向 */
export type SortDir = 'asc' | 'desc';

/** 通用可选项，用于下拉框 */
export interface Option<T extends string = string> {
  value: T;
  label: string;
}
