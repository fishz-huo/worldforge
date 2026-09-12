/**
 * SQLite 引擎（sql.js / SQLite WASM）核心
 * ------------------------------------------------------------------
 * 职责：持有内存数据库实例，对外提供 all / one / run / tx 四个最小 SQL 原语，
 * 以及「写操作打脏标记 → 800ms 去抖落盘到 IndexedDB」的持久化策略。
 *
 * 为什么用「全量导出」而不是增量写：
 *  - sql.js 没有增量持久化能力，导出为完整字节数组是最稳的方式；
 *  - 图片等大二进制不入库，所以数据库体积通常只有几百 KB，全量导出开销可接受。
 *
 * 初始化与迁移见 init.ts，保存状态（状态栏展示）见 saveStatus.ts。
 */
import type { Database, SqlValue } from 'sql.js';
import { DB_KV_KEY } from './schema';
import { idbPut, STORE_KV } from './idb';
import { emitStatus, getSaveState, onSaveStatus, type SaveStatus } from './saveStatus';

/** 一行查询结果 */
export type Row = Record<string, SqlValue>;
/** SQL 绑定参数 */
export type Params = SqlValue[] | Record<string, SqlValue>;
export { getSaveState, onSaveStatus };
export type { SaveStatus };

/** 内存数据库实例（由 init.ts 装载） */
let db: Database | null = null;
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const SAVE_DEBOUNCE_MS = 800;

/** 数据库是否已就绪 */
export function isReady(): boolean {
  return db !== null;
}

/** 获取数据库实例；未初始化时抛错，便于尽早暴露调用顺序问题 */
export function getDb(): Database {
  if (!db) throw new Error('[worldforge] 数据库尚未初始化，请先 await initDatabase()');
  return db;
}

/** 装载数据库实例（仅供 init.ts 调用） */
export function attachDb(instance: Database | null): void {
  db = instance;
}

/* ------------------------------ SQL 原语 ------------------------------ */

/** 查询多行 */
export function all<T = Row>(sql: string, params: Params = []): T[] {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(params as never);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
    return rows;
  } finally {
    stmt.free();
  }
}

/** 查询单行 */
export function one<T = Row>(sql: string, params: Params = []): T | undefined {
  return all<T>(sql, params)[0];
}

/** 执行写语句（自动打脏标记） */
export function run(sql: string, params: Params = []): void {
  getDb().run(sql, params as never);
  markDirty();
}

/** 执行多条语句（DDL 等） */
export function exec(sql: string): void {
  getDb().exec(sql);
  markDirty();
}

/**
 * 事务包装：异常时回滚。
 *
 * 支持**可重入**：仓储层的 saveMany / purge 等内部也会调用 tx()，
 * 如果直接 BEGIN 会触发 SQLite 的 "cannot start a transaction within a transaction"。
 * 这里用深度计数，只有最外层真正 BEGIN / COMMIT，内层共用同一事务，
 * 因此「还原快照」这种复合操作要么整体成功，要么整体回滚。
 */
let txDepth = 0;

export function tx<T>(fn: () => T): T {
  const database = getDb();
  if (txDepth > 0) return fn();
  database.run('BEGIN');
  txDepth += 1;
  try {
    const result = fn();
    database.run('COMMIT');
    markDirty();
    return result;
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  } finally {
    txDepth -= 1;
  }
}

/* --------------------------- settings 便捷读写 --------------------------- */

/** 读取配置项（值统一以 JSON 存储） */
export function getSetting<T>(key: string, fallback: T): T {
  const row = one<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

/** 写入配置项（值统一以 JSON 存储） */
export function setSetting(key: string, value: unknown): void {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    JSON.stringify(value),
  ]);
}

/* ------------------------------ 持久化 ------------------------------ */

/** 打脏标记并安排去抖落盘 */
export function markDirty(): void {
  dirty = true;
  emitStatus('idle');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flush();
  }, SAVE_DEBOUNCE_MS);
}

/** 强制把待写入内容标记为脏（导入备份 / 直接改库后调用） */
export function forceDirty(): void {
  dirty = true;
}

/** 立即落盘；返回是否真正写入了数据 */
export async function flush(): Promise<boolean> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!dirty || !db) return false;
  emitStatus('saving');
  try {
    const bytes = db.export();
    await idbPut(STORE_KV, DB_KV_KEY, bytes);
    dirty = false;
    emitStatus('saved', { savedAt: Date.now() });
    return true;
  } catch (err) {
    console.error('[worldforge] 保存失败', err);
    emitStatus('error', { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/** 导出当前数据库字节（导出 / 备份用） */
export function exportBytes(): Uint8Array {
  return getDb().export();
}

/** 注册生命周期钩子：页面隐藏 / 关闭前强制落盘，避免丢数据 */
export function installLifecycleFlush(): void {
  const handler = () => {
    if (dirty) void flush();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handler();
  });
  window.addEventListener('pagehide', handler);
  window.addEventListener('beforeunload', handler);
}
