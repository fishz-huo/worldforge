/**
 * 建表 DDL（第二部分：地图 / 时间轴 / 文稿 / 版本 / 支撑表）
 * 第一部分见 schema-core.ts。
 */

/** 空间、时间、文稿与支撑表的建表语句 */
export const DDL_EXTRA = /* sql */ `
-- 地图（同一世界观可有多张，承载不同时期/分支）
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  branch_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  asset_id TEXT,
  period TEXT NOT NULL DEFAULT '',
  period_t REAL,
  opacity REAL NOT NULL DEFAULT 0.9,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_maps_world ON maps(world_id);

-- 地图标记点（坐标为 0~1 归一化值）
CREATE TABLE IF NOT EXISTS map_pins (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  card_id TEXT,
  x REAL NOT NULL DEFAULT 0.5,
  y REAL NOT NULL DEFAULT 0.5,
  label TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '📍',
  color TEXT NOT NULL DEFAULT '#ef4444',
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pins_map ON map_pins(map_id);

-- 地图区域（行政区 / 势力范围 / 资源区）
CREATE TABLE IF NOT EXISTS map_regions (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#38bdf8',
  points TEXT NOT NULL DEFAULT '[]',
  resources TEXT NOT NULL DEFAULT '{}',
  period TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_regions_map ON map_regions(map_id);

-- 时间轴泳道
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  branch_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'event',
  color TEXT NOT NULL DEFAULT '#f59e0b',
  order_index INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  valued INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tracks_world ON tracks(world_id);

-- 时间轴条目（刻度为数值，可为负）
CREATE TABLE IF NOT EXISTS timeline_entries (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  branch_id TEXT,
  track_id TEXT NOT NULL,
  card_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  start_t REAL NOT NULL DEFAULT 0,
  end_t REAL,
  instant INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  value REAL,
  map_id TEXT,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_entries_track ON timeline_entries(track_id);
CREATE INDEX IF NOT EXISTS idx_entries_card ON timeline_entries(card_id);

-- 纪元分段
CREATE TABLE IF NOT EXISTS eras (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  start_t REAL NOT NULL DEFAULT 0,
  end_t REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#334155',
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_eras_world ON eras(world_id);

-- 文稿（正文 / 大纲文本 / 笔记）
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  branch_id TEXT,
  kind TEXT NOT NULL DEFAULT 'manuscript',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  card_id TEXT,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_docs_world ON docs(world_id);

-- 大纲树节点
CREATE TABLE IF NOT EXISTS outline_nodes (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  parent_id TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idea',
  card_id TEXT,
  link_doc_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_outline_doc ON outline_nodes(doc_id);

-- 设定版本快照（整库 JSON，不含图片二进制）
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  snapshot TEXT NOT NULL DEFAULT '{}',
  size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_versions_world ON versions(world_id);

-- 资源元数据（二进制在 IndexedDB 的 assets 仓库）
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'image/png',
  size INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'image',
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_assets_world ON assets(world_id);

-- 全局键值配置
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- 插件
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '0.1.0',
  author TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  builtin INTEGER NOT NULL DEFAULT 0,
  settings_schema TEXT NOT NULL DEFAULT '{}',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0
);
`;
