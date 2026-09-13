/**
 * 插件宿主 API 契约（PluginAPI）
 * ------------------------------------------------------------------
 * 需求 14：插件区与插件插口。
 * v0.1 的插件是运行在同一页面里的 ES 模块，宿主通过 PluginAPI 暴露能力，
 * 插件只能通过该接口与宿主交互（v0.1 无沙箱，属于可信任模型，详见插件开发指南）。
 */
import type { ReactNode } from 'react';
import type { Card } from './card';
import type { CardTypeDef, FieldDef } from './field';
import type { Doc } from './doc';
import type { Relation, Tag } from './tag';
import type { PluginManifest, PluginSettingDef, ThemeDef } from './misc';
import type { ExportAreaSummary, ExportFile, ExportRequest } from './export';

/** 侧边面板定义：插件可以往「插件面板区」塞入自己的界面 */
export interface PluginPanelDef {
  id: string;
  title: string;
  /** lucide 图标名 */
  icon?: string;
  /** 面板渲染函数，返回 React 节点 */
  render: () => ReactNode;
}

/** 命令面板指令 */
export interface PluginCommandDef {
  id: string;
  title: string;
  /** 副标题 / 分组提示 */
  hint?: string;
  run: () => void | Promise<void>;
}

/** 卡片右键/详情页动作 */
export interface PluginCardActionDef {
  id: string;
  title: string;
  /** 限定生效的卡片类型；为空表示全部类型 */
  types?: string[];
  run: (card: Card) => void | Promise<void>;
}

/** 导出器：注册后出现在「导出」菜单 */
export interface PluginExporterDef {
  id: string;
  title: string;
  /** 文件扩展名，如 'md' */
  ext: string;
  /** 生成文本内容 */
  run: (ctx: { cards: Card[]; worldName: string }) => string;
}

/** 宿主事件名 */
export type PluginEvent =
  | 'app:ready'
  | 'card:save'
  | 'card:delete'
  | 'world:switch'
  | 'branch:switch'
  | 'doc:save';

/** 事件回调签名 */
export type PluginEventHandler = (payload: unknown) => void;

/** 只读查询能力，避免插件直接摸数据库 */
export interface PluginQuery {
  listCards: () => Card[];
  getCard: (id: string) => Card | undefined;
  listTags: () => Tag[];
  listRelations: () => Relation[];
  listDocs: () => Doc[];
  currentWorldId: () => string | null;
  currentBranchId: () => string | null;
}

/** 插件要写盘的一个文件（text 与 bytes 二选一，bytes 优先） */
export interface PluginOutputFile {
  name: string;
  /** 相对子目录（可空）：一次导出很多文件时可以分目录放 */
  subDir?: string;
  text?: string;
  bytes?: Uint8Array;
  mime?: string;
}

/** 写盘结果：失败不静默，errors 里逐条列清楚 */
export interface PluginSaveReport {
  /** desktop = 直接写进用户选的目录；download = 浏览器逐个下载 */
  mode: 'desktop' | 'download';
  dir: string | null;
  written: string[];
  errors: string[];
}

/**
 * 插件写盘能力。
 * 插件是浏览器上下文里的代码，拿不到文件系统，跨平台差异（桌面端直写 / 网页端下载）
 * 一律由宿主兜住，插件只负责「给我这些文件」。
 */
export interface PluginFileAPI {
  /** 桌面版才能选目录（网页版没有目录权限，只能走浏览器下载） */
  canPickDirectory: () => boolean;
  /** 让用户挑一个导出目录；用户取消返回 null */
  pickDirectory: (defaultPath?: string) => Promise<string | null>;
  /** 写出一组文件 */
  writeFiles: (files: PluginOutputFile[], dir: string | null) => Promise<PluginSaveReport>;
  /** 打印一段 HTML：用户在打印对话框里选「另存为 PDF」并挑保存位置 */
  printDocument: (html: string, title: string) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * 文档导出服务。
 * 采集与排版都在宿主侧（纯函数、可自测）：卡片字段怎么展开、大纲树怎么还原、
 * Word 与 PDF 怎么排版，插件不需要也不应该重复实现一遍；
 * 插件负责的是「导出哪些区域、哪些格式、放到哪里、失败了怎么告诉用户」。
 */
export interface PluginDocExportAPI {
  /** 当前世界观里可导出的区域（含条目数与字数，不含正文） */
  areas: () => ExportAreaSummary[];
  /** 按请求构建待写盘的文件；pdf 项只带 html，交给 files.printDocument */
  build: (request: ExportRequest) => Promise<ExportFile[]>;
}

/** 插件宿主 API */
export interface PluginAPI {
  /** 宿主版本，插件可据此做兼容判断 */
  version: string;
  /** 当前插件 id */
  pluginId: string;
  /** 用户为该插件填写的设置值（实时读取，改完即生效） */
  settings: Record<string, unknown>;
  /** 写回一个设置值：插件面板里也可以改设置，不必绕去插件详情页 */
  setSetting: (key: string, value: unknown) => void;

  /** 注册新的卡片类型（出现在卡片库新建菜单） */
  registerCardType: (def: CardTypeDef) => void;
  /** 为已有卡片类型追加字段 */
  registerCardField: (cardType: string, field: FieldDef) => void;
  /** 注册侧边面板 */
  registerPanel: (panel: PluginPanelDef) => void;
  /** 注册命令面板指令 */
  registerCommand: (cmd: PluginCommandDef) => void;
  /** 注册卡片动作 */
  registerCardAction: (action: PluginCardActionDef) => void;
  /** 注册配色主题 */
  registerTheme: (theme: ThemeDef) => void;
  /** 注册导出器 */
  registerExporter: (exporter: PluginExporterDef) => void;
  /** 订阅宿主事件，返回取消订阅函数 */
  on: (event: PluginEvent, handler: PluginEventHandler) => () => void;
  /** 只读查询 */
  query: PluginQuery;
  /** 轻提示 */
  toast: (message: string, kind?: 'info' | 'success' | 'warn' | 'error') => void;
  /** 写盘与打印（导出类插件用；跨平台差异由宿主兜住） */
  files: PluginFileAPI;
  /** 文档导出：区域采集与各格式渲染 */
  docExport: PluginDocExportAPI;
  /**
   * 供插件渲染界面用的 React 运行时。
   * 插件以 Blob 模块方式载入，无法 `import 'react'`（裸模块名不可解析），
   * 因此宿主把 React 直接交给插件：`const { React } = api.ui`。
   */
  ui: { React: typeof import('react') };
  /** 插件私有键值存储（持久化在插件记录里） */
  storage: {
    get: <T>(key: string, fallback: T) => T;
    set: (key: string, value: unknown) => void;
  };
}

/** 插件模块的导出形状 */
export interface PluginModule {
  manifest?: PluginManifest;
  activate: (api: PluginAPI) => void | (() => void);
}

/** 插件在宿主中的运行时状态 */
export interface PluginRuntime {
  id: string;
  name: string;
  enabled: boolean;
  /** 已注册的清理函数 */
  disposers: (() => void)[];
  /** 载入失败信息 */
  error?: string;
}

/** 插件清单字段说明（供 UI 展示） */
export type PluginSettingsSchema = Record<string, PluginSettingDef>;
