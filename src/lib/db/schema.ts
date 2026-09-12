/**
 * 数据库 schema 汇总
 * ------------------------------------------------------------------
 * 全部结构化数据都放在 sql.js（SQLite WASM）里，二进制快照落到 IndexedDB。
 * 表结构变更时提升 SCHEMA_VERSION，并在 sqlite.ts 的 migrate() 里做迁移分支。
 * DDL 分两部分存放，避免单文件过长：
 *   - schema-core.ts  设定层（世界 / 分支 / 卡片 / 图库 / 标签 / 关联）
 *   - schema-extra.ts 空间与时间（地图 / 时间轴）与文稿、版本、支撑表
 */
import { DDL_CORE } from './schema-core';
import { DDL_EXTRA } from './schema-extra';

export { DDL_CORE, DDL_EXTRA };

/** 当前 schema 版本，写入 settings.schemaVersion */
export const SCHEMA_VERSION = 1;

/** 数据库在 IndexedDB 里的键名 */
export const DB_KV_KEY = 'worldforge.sqlite';

/** 全部建表语句；用 IF NOT EXISTS 保证可重复执行 */
export const DDL = `${DDL_CORE}\n${DDL_EXTRA}`;

/** 表名清单（自检与调试用） */
export const TABLE_NAMES = [
  'worlds', 'branches', 'cards', 'card_assets', 'tags', 'card_tags', 'relations',
  'maps', 'map_pins', 'map_regions', 'tracks', 'timeline_entries', 'eras',
  'docs', 'outline_nodes', 'versions', 'assets', 'settings', 'plugins',
] as const;
