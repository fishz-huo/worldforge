/**
 * 通用表仓储（Table-Driven Repository）
 * ------------------------------------------------------------------
 * 19 张表如果各写一套 CRUD，会产生大量重复代码。这里用一个「表描述」驱动：
 *   - columns     : 普通列
 *   - jsonColumns : 需要 JSON 序列化/反序列化的列（值为默认值，如 {} / []）
 * 于是新增实体只需要在 tables.ts 里加一行描述。
 */
import type { SqlValue } from 'sql.js';
import { all, one, run, tx, type Params, type Row } from './sqlite';

/** 表描述 */
export interface TableSpec {
  /** 物理表名 */
  table: string;
  /** 除 id 外的列；id 由仓储自动处理 */
  columns: string[];
  /** JSON 列 → 默认值 */
  jsonColumns: Record<string, unknown>;
}

/** 定义一个表描述 */
export function defineTable(
  table: string,
  columns: string[],
  jsonColumns: Record<string, unknown> = {},
): TableSpec {
  return { table, columns, jsonColumns };
}

/** 把 JS 值编码成 SQLite 可接受的绑定值 */
function encode(spec: TableSpec, column: string, value: unknown): SqlValue {
  if (column in spec.jsonColumns) {
    if (value === undefined || value === null) return JSON.stringify(spec.jsonColumns[column]);
    return JSON.stringify(value);
  }
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** 把数据库行解码成领域对象 */
export function decodeRow<T>(spec: TableSpec, row: Row): T {
  const out: Record<string, unknown> = {};
  out.id = row.id;
  spec.columns.forEach((col) => {
    const raw = row[col];
    if (col in spec.jsonColumns) {
      if (raw === null || raw === undefined || raw === '') {
        out[col] = spec.jsonColumns[col];
        return;
      }
      try {
        out[col] = JSON.parse(String(raw));
      } catch {
        out[col] = spec.jsonColumns[col];
      }
      return;
    }
    out[col] = raw === undefined ? null : raw;
  });
  return out as T;
}

/** 生成 SQL 的列清单 */
function colsOf(spec: TableSpec): string[] {
  return ['id', ...spec.columns];
}

/** 插入或整行更新（UPSERT） */
export function saveRow<T extends { id: string }>(spec: TableSpec, obj: T): void {
  const cols = colsOf(spec);
  const placeholders = cols.map(() => '?').join(', ');
  const updates = spec.columns.map((c) => `${c} = excluded.${c}`).join(', ');
  const sql = `INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updates}`;
  const params = cols.map((c) => encode(spec, c, (obj as Record<string, unknown>)[c]));
  run(sql, params);
}

/** 批量 UPSERT（自动包在事务里，快得多） */
export function saveRows<T extends { id: string }>(spec: TableSpec, list: T[]): void {
  tx(() => list.forEach((item) => saveRow(spec, item)));
}

/** 查询多行 */
export function listRows<T>(
  spec: TableSpec,
  where = '',
  params: Params = [],
  orderBy = '',
): T[] {
  const sql = `SELECT * FROM ${spec.table}${where ? ` WHERE ${where}` : ''}${orderBy ? ` ORDER BY ${orderBy}` : ''}`;
  return all<Row>(sql, params).map((row) => decodeRow<T>(spec, row));
}

/** 查询单行 */
export function getRow<T>(spec: TableSpec, id: string): T | undefined {
  const row = one<Row>(`SELECT * FROM ${spec.table} WHERE id = ?`, [id]);
  return row ? decodeRow<T>(spec, row) : undefined;
}

/** 统计行数 */
export function countRows(spec: TableSpec, where = '', params: Params = []): number {
  const row = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${spec.table}${where ? ` WHERE ${where}` : ''}`,
    params,
  );
  return row?.n ?? 0;
}

/** 按 id 删除 */
export function deleteRow(spec: TableSpec, id: string): void {
  run(`DELETE FROM ${spec.table} WHERE id = ?`, [id]);
}

/** 条件删除 */
export function deleteWhere(spec: TableSpec, where: string, params: Params = []): void {
  run(`DELETE FROM ${spec.table} WHERE ${where}`, params);
}

/** 仓储对象：业务层直接用的 API */
export interface Repo<T extends { id: string }> {
  spec: TableSpec;
  list: (where?: string, params?: Params, orderBy?: string) => T[];
  get: (id: string) => T | undefined;
  save: (obj: T) => void;
  saveMany: (list: T[]) => void;
  remove: (id: string) => void;
  removeWhere: (where: string, params?: Params) => void;
  count: (where?: string, params?: Params) => number;
}

/** 由表描述创建仓储 */
export function createRepo<T extends { id: string }>(spec: TableSpec): Repo<T> {
  return {
    spec,
    list: (where, params, orderBy) => listRows<T>(spec, where, params, orderBy),
    get: (id) => getRow<T>(spec, id),
    save: (obj) => saveRow(spec, obj),
    saveMany: (list) => saveRows(spec, list),
    remove: (id) => deleteRow(spec, id),
    removeWhere: (where, params) => deleteWhere(spec, where, params),
    count: (where, params) => countRows(spec, where, params),
  };
}
