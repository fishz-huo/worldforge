/**
 * 建表 DDL（第一部分：设定层）
 * ------------------------------------------------------------------
 * 世界观体系、平行世界分支、卡片、卡片图库、标签、关联。
 * 第二部分（地图 / 时间轴 / 文稿 / 版本 / 支撑表）见 schema-extra.ts。
 */

/** 设定层建表语句 */
export const DDL_CORE = /* sql */ `
-- 世界观体系（顶层容器）
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- 平行世界分支
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  divergence TEXT NOT NULL DEFAULT '',
  divergence_t REAL,
  forked_from TEXT,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_branches_world ON branches(world_id);

-- 卡片：角色/地点/事件/底层逻辑/势力/物品/概念/参考资料/随笔
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  branch_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  fields TEXT NOT NULL DEFAULT '{}',
  cover_asset TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cards_world ON cards(world_id);
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type);
CREATE INDEX IF NOT EXISTS idx_cards_branch ON cards(branch_id);

-- 卡片图库（一张卡片多张图）
CREATE TABLE IF NOT EXISTS card_assets (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_card_assets_card ON card_assets(card_id);

-- 标签
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tags_world ON tags(world_id);

-- 卡片 ↔ 标签
CREATE TABLE IF NOT EXISTS card_tags (
  card_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (card_id, tag_id)
);

-- 卡片之间的自由关联
CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  branch_id TEXT,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  directed INTEGER NOT NULL DEFAULT 1,
  start_t REAL,
  end_t REAL,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
`;
