/**
 * 资源（图片）、版本快照、插件记录
 * ------------------------------------------------------------------
 * 需求 5 ：图片插入。二进制存 IndexedDB 的 assets 仓库，SQLite 只存元数据。
 * 需求 12：设定版本快照，可随时调出与当前设定对比。
 * 需求 14：插件区与插件插口。
 */
import type { Id } from './common';

/** 资源元数据（二进制在 IndexedDB assets 仓库，键 = id） */
export interface Asset {
  id: Id;
  world_id: Id;
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  /** image = 图片；file = 其它附件 */
  kind: 'image' | 'file';
  created_at: number;
}

/** 设定版本快照 */
export interface Version {
  id: Id;
  world_id: Id;
  name: string;
  note: string;
  /** 序列化后的 JSON 快照（卡片/标签/关联/地图/时间轴/文稿） */
  snapshot: string;
  /** 快照字节数，用于展示体积 */
  size: number;
  created_at: number;
}

/** 快照内部结构（snapshot 字段反序列化后的样子） */
export interface SnapshotPayload {
  schemaVersion: number;
  world: unknown;
  branches: unknown[];
  cards: unknown[];
  tags: unknown[];
  cardTags: unknown[];
  /** 卡片图库关联（card_assets）—— 漏掉它会让图片「还在资源库里、却不在卡片上」 */
  cardAssets: unknown[];
  relations: unknown[];
  maps: unknown[];
  pins: unknown[];
  regions: unknown[];
  tracks: unknown[];
  entries: unknown[];
  eras: unknown[];
  docs: unknown[];
  outlineNodes: unknown[];
}

/** 插件设置项声明：宿主据此自动渲染设置表单 */
export interface PluginSettingDef {
  type: 'string' | 'number' | 'boolean' | 'color' | 'select';
  label: string;
  default?: string | number | boolean;
  options?: { value: string; label: string }[];
  hint?: string;
}

/** 插件记录（持久化在 plugins 表） */
export interface PluginRecord {
  id: Id;
  name: string;
  version: string;
  author: string;
  description: string;
  /** 插件源码（单文件 ES 模块） */
  code: string;
  /** 1 启用 / 0 停用 */
  enabled: number;
  /** 1 内置示例 / 0 用户载入 */
  builtin: number;
  /**
   * 插件设置声明（宿主据此自动渲染设置表单）。
   * ⚠️ 字段名必须与 plugins 表的列名一致：通用仓储直接用**列名**当对象键，
   * 写成 settingsSchema 这类驼峰会导致读不到（undefined）也存不进去。
   */
  settings_schema: Record<string, PluginSettingDef>;
  /** 用户填写的设置值 */
  settings: Record<string, unknown>;
  created_at: number;
}

/** 插件清单：插件源码里 `export const manifest` 的形状 */
export interface PluginManifest {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  settings?: Record<string, PluginSettingDef>;
}

/** 主题定义：插件可通过 registerTheme 提供整站配色 */
export interface ThemeDef {
  id: string;
  name: string;
  /** 明暗模式归属 */
  mode: 'dark' | 'light';
  /** CSS 变量键值，例如 { '--primary': '262 83% 58%' } */
  vars: Record<string, string>;
  fromPlugin?: string;
}
