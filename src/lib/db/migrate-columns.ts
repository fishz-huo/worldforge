/**
 * 结构迁移（ALTER TABLE 加列 / DROP TABLE 删表）
 * ------------------------------------------------------------------
 * 与建表分开的原因：DDL 里的 `CREATE TABLE IF NOT EXISTS` 只能建**新表**，
 * 老用户数据库里已经存在的表不会因此多出新列。
 * 之前只加表不加列，所以一直没有这段代码；v0.2 给 map_pins / map_regions
 * 加 `layer_id`（地图图层）是仓库第一次真正做列迁移。
 *
 * 为什么先查 PRAGMA 再 ALTER：SQLite 没有 `ADD COLUMN IF NOT EXISTS`，
 * 直接 ALTER 在第二次启动时会报 "duplicate column name" 而让整个应用起不来。
 * 这一层必须是**幂等**的 —— 每次启动都会跑。
 */
import { all, run } from './sqlite';

/** 一次列迁移的描述 */
interface ColumnMigration {
  table: string;
  column: string;
  /** 列定义（不含列名），例如 `TEXT` / `INTEGER NOT NULL DEFAULT 0` */
  ddl: string;
  /** 这条迁移为什么存在（出问题时能直接看懂） */
  why: string;
}

/**
 * 全部列迁移，按加入的版本顺序排列。
 * 加新列时在这里追加一条即可，不需要动 schema-extra.ts 的建表语句 ——
 * 建表语句只对"新库"生效，这里对"老库"生效，两边都要写。
 */
export const COLUMN_MIGRATIONS: ColumnMigration[] = [
  {
    table: 'map_pins',
    column: 'layer_id',
    ddl: 'TEXT',
    why: 'v0.2 地图多图层：标记可以归属某一层；老数据为 NULL，表示不归属任何层',
  },
  {
    table: 'map_regions',
    column: 'layer_id',
    ddl: 'TEXT',
    why: 'v0.2 地图多图层：区域可以归属某一层；老数据为 NULL',
  },
  {
    table: 'cards',
    column: 'code',
    ddl: "TEXT NOT NULL DEFAULT ''",
    why: '卡片永久编号（CHR-001）：让 [[编号]] 在标题改动后依然指向同一张卡片；'
      + '老数据为空串，表示「未编号」，由用户手填或一键批量补全',
  },
  {
    table: 'cards',
    column: 'code_aliases',
    ddl: "TEXT NOT NULL DEFAULT '[]'",
    why: '改编号后保留的旧编号（JSON 数组）：旧文稿里的 [[旧编号]] 仍然能跳转；老数据为空数组',
  },
  {
    table: 'map_pins',
    column: 'meta',
    ddl: "TEXT NOT NULL DEFAULT '{}'",
    why: '第三批地形标记：扩展字段列（JSON）。地形 = { kind:"terrain", symbol, size, rotation }，'
      + '老数据为空对象，因此读写与旧版本完全一致；只加列、不重建表，老备份照旧能导入',
  },
];

/**
 * 表级迁移（DROP TABLE）
 * ------------------------------------------------------------------
 * 与列迁移分开写：列迁移是"补东西"，删表是"撤东西"，两者的幂等性
 * 保证也不一样（DROP TABLE IF EXISTS 天然幂等，不需要先查 PRAGMA）。
 *
 * 目前只有一条：撤掉 v0.2 的 map_layers。
 * 为什么不是"留着不用"：留着就会出现在数据模型文档、备份检查器与
 * 表名自检里，而界面上再也建不出图层 —— 一张永远为空的表比没有更让人困惑。
 */
const DROP_TABLES: { table: string; why: string }[] = [
  {
    table: 'map_layers',
    why: 'v0.2.1 撤掉地图多图层：图层只是叠底图，与"分层管理标记"的预期不符',
  },
];

/**
 * 执行全部表级迁移。
 * @returns 实际删掉了哪些表（自测与启动日志用）
 */
export function runTableMigrations(): string[] {
  const applied: string[] = [];
  DROP_TABLES.forEach((m) => {
    if (!tableExists(m.table)) return;
    run(`DROP TABLE IF EXISTS ${m.table}`);
    applied.push(m.table);
  });
  return applied;
}

/** 某张表现有的列名 */
function columnsOf(table: string): Set<string> {
  return new Set(all<{ name: string }>(`PRAGMA table_info(${table})`).map((r) => r.name));
}

/** 表是否存在（对不存在的表做 PRAGMA 会得到空集合，所以顺便判一下） */
function tableExists(table: string): boolean {
  return all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [table],
  ).length > 0;
}

/**
 * 执行全部列迁移。
 * @returns 实际执行了哪些迁移（自测与启动日志用）
 */
export function runColumnMigrations(): string[] {
  const applied: string[] = [];
  COLUMN_MIGRATIONS.forEach((m) => {
    if (!tableExists(m.table)) return; // 表还没建（全新库由 DDL 负责），跳过
    if (columnsOf(m.table).has(m.column)) return; // 已经加过，保持幂等
    run(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.ddl}`);
    applied.push(`${m.table}.${m.column}`);
  });
  return applied;
}

/** 缺哪些列（自测用：迁移跑完这里应该是空的） */
export function missingColumns(): string[] {
  return COLUMN_MIGRATIONS
    .filter((m) => tableExists(m.table) && !columnsOf(m.table).has(m.column))
    .map((m) => `${m.table}.${m.column}`);
}
