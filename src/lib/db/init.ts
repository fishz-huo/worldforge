/**
 * 数据库初始化与迁移
 * ------------------------------------------------------------------
 * 启动顺序：载入 wasm → 从 IndexedDB 取上次的二进制快照 →
 *          有则恢复并校验 schema 版本，无则建表并写入示例数据。
 * 与 SQL 引擎本身分离，方便 sqlite.ts 保持在 200 行以内。
 */
import initSqlJs, { type SqlJsStatic } from 'sql.js';
// Vite 会把 wasm 作为静态资源发射，并返回可用的 URL
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { DB_KV_KEY, DDL, SCHEMA_VERSION } from './schema';
import { idbGet, STORE_KV } from './idb';
import { all, attachDb, flush, getDb, getSetting, markDirty, forceDirty, setSetting } from './sqlite';

let sqlStatic: SqlJsStatic | null = null;

/** 获取 sql.js 静态模块（重建数据库实例时需要） */
function getSqlStatic(): SqlJsStatic {
  if (!sqlStatic) throw new Error('[worldforge] sql.js 尚未初始化');
  return sqlStatic;
}

/** 初始化数据库（应用启动时调用一次） */
export async function initDatabase(): Promise<void> {
  if (getDbSafe()) return;
  sqlStatic = await initSqlJs({ locateFile: () => wasmUrl });
  const sql = getSqlStatic();

  const saved = await idbGet<Uint8Array | ArrayBuffer>(STORE_KV, DB_KV_KEY);
  if (saved) {
    const bytes = saved instanceof Uint8Array ? saved : new Uint8Array(saved);
    try {
      attachDb(new sql.Database(bytes));
      migrate();
      return;
    } catch (err) {
      console.error('[worldforge] 快照损坏，改为新建数据库', err);
      attachDb(null);
    }
  }

  attachDb(new sql.Database());
  getDb().exec(DDL);
  setSetting('schemaVersion', SCHEMA_VERSION);
  markDirty();
  await flush();
}

/** 判断是否已初始化（避免 getDb 抛错） */
function getDbSafe(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}

/** 版本迁移：v0.1 只有版本 1，这里保证 DDL 幂等执行即可 */
function migrate(): void {
  const database = getDb();
  // 幂等补建：老版本快照缺表时能自动补齐
  database.exec(DDL);
  const current = getSetting<number>('schemaVersion', 0);
  if (current !== SCHEMA_VERSION) {
    setSetting('schemaVersion', SCHEMA_VERSION);
    markDirty();
  }
}

/** 用字节数组整体替换数据库（导入备份用） */
export async function replaceWithBytes(bytes: Uint8Array): Promise<void> {
  const sql = getSqlStatic();
  const previous = getDb();
  attachDb(new sql.Database(new Uint8Array(bytes)));
  previous.close();
  forceDirty();
  await flush();
}

/** 关闭数据库（仅在彻底重置时调用） */
export function closeDatabase(): void {
  try {
    getDb().close();
  } catch {
    /* 未初始化时忽略 */
  }
  attachDb(null);
}

/** 列出当前库中的所有表名（自检与调试用） */
export function listTables(): string[] {
  return all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map((r) => r.name);
}
