/**
 * 插件宿主：把宿主能力包装成 PluginAPI 并负责载入 / 卸载插件
 * ------------------------------------------------------------------
 * 载入方式：把插件源码包成 Blob → URL.createObjectURL → 动态 import()。
 * 这样做的好处是插件就是一个独立的 ES 模块，不会污染主 bundle，
 * 停用时只需注销注册表项与事件订阅。
 *
 * 安全模型：v0.1 的插件运行在页面同一上下文里，属于「可信任插件」，
 * 请只载入你自己写的或信任来源的插件（详见 docs/插件开发指南.md）。
 */
import type { PluginAPI, PluginDocExportAPI, PluginFileAPI, PluginManifest, PluginModule, PluginRecord } from '@/types';
import * as React from 'react';
import { onPluginEvent } from './events';
import * as reg from './registry';

/** 宿主（软件）版本号，插件可据此做兼容判断 */
export const HOST_VERSION = '0.2.1';

/**
 * 插件在 manifest 里声明的版本号：没声明 / 不是字符串 / 只有空白 → null。
 * 返回 null 表示「插件自己没说」，此时插件记录里原来的值（建表默认 0.1.0）保持不变 ——
 * 宿主不替插件猜版本号，因为记录里那一列此前只有硬编码的 0.1.0，改它没有依据。
 */
export function manifestVersion(manifest: PluginManifest | undefined): string | null {
  const v = manifest?.version;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** 宿主与 store 之间的桥接：避免 lib → store 的反向依赖 */
export interface HostBridge {
  query: PluginAPI['query'];
  toast: (message: string, kind?: 'info' | 'success' | 'warn' | 'error') => void;
  /** 写盘 / 打印 / 文档导出：由 store 侧接到 lib 上（见 store/slices/plugin-bridge.ts） */
  files: PluginFileAPI;
  docExport: PluginDocExportAPI;
  readSettings: (pluginId: string) => Record<string, unknown>;
  saveSettings: (pluginId: string, settings: Record<string, unknown>) => void;
  /**
   * 回填插件在 manifest 里声明的信息（版本号 + 设置结构）：详情页才能显示正确版本、
   * 自动渲染设置表单。声明来自插件源码，持久化归 store 管，所以通过桥接回调写库。
   */
  applyManifest: (pluginId: string, manifest: PluginManifest) => void;
}

/** 构造某插件的 API 实例 */
export function createPluginAPI(record: PluginRecord, bridge: HostBridge): PluginAPI {
  const pid = record.id;
  const pname = record.name;
  /** 插件私有存储挂在 settings.__storage 下，随插件记录一起持久化 */
  const storageBag = (): Record<string, unknown> => {
    const current = bridge.readSettings(pid);
    return (current.__storage as Record<string, unknown>) ?? {};
  };

  const api: PluginAPI = {
    version: HOST_VERSION,
    pluginId: pid,
    settings: {}, // 占位：下面立刻换成访问器
    /** 面板里改设置也走同一条持久化路径，插件不必自己维护一份偏好 */
    setSetting: (key, value) => bridge.saveSettings(pid, { ...bridge.readSettings(pid), [key]: value }),

    registerCardType: (def) => reg.registerCardType(def, pid, pname),
    registerCardField: (cardType, field) => reg.registerCardField(cardType, field, pid, pname),
    registerPanel: (panel) => reg.registerPanel(panel, pid, pname),
    registerCommand: (cmd) => reg.registerCommand(cmd, pid, pname),
    registerCardAction: (action) => reg.registerCardAction(action, pid, pname),
    registerTheme: (theme) => reg.registerTheme(theme, pid, pname),
    registerExporter: (exporter) => reg.registerExporter(exporter, pid, pname),
    on: (event, handler) => onPluginEvent(event, handler),
    query: bridge.query,
    toast: (message, kind = 'info') => bridge.toast(`[${pname}] ${message}`, kind),
    files: bridge.files,
    docExport: bridge.docExport,
    ui: { React },
    storage: {
      get: <T,>(key: string, fallback: T): T => {
        const bag = storageBag();
        return (key in bag ? (bag[key] as T) : fallback);
      },
      set: (key, value) => {
        const bag = { ...storageBag(), [key]: value };
        bridge.saveSettings(pid, { ...bridge.readSettings(pid), __storage: bag });
      },
    },
  };

  /**
   * settings 做成访问器，而不是 activate 时取一次的快照。
   * 若只给快照，用户在插件设置表单里改完，插件读到的还是旧值，
   * 必须「停用再启用」才生效——插件作者很难解释这种现象。
   */
  Object.defineProperty(api, 'settings', { get: () => bridge.readSettings(pid), enumerable: true });

  return api;
}

/** 已载入插件的运行时句柄 */
export interface PluginHandle {
  /** 卸载：调用插件返回的清理函数，注销注册项与事件订阅 */
  dispose: () => void;
}

/** 载入并激活一个插件 */
export async function loadPlugin(record: PluginRecord, bridge: HostBridge): Promise<PluginHandle> {
  // 先清掉可能残留的注册（热重载场景）
  reg.unregisterPlugin(record.id);
  const blob = new Blob([record.code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  let cleanup: (() => void) | void;
  try {
    const mod = (await import(/* @vite-ignore */ url)) as PluginModule;
    // manifest 整份交给宿主：既回填设置结构，也把插件声明的版本号写回记录（否则永远显示 0.1.0）
    if (mod.manifest) bridge.applyManifest(record.id, mod.manifest);
    const api = createPluginAPI(record, bridge);
    cleanup = mod.activate(api);
  } finally {
    // 模块已经求值完成，可以回收 URL（模块本身仍留在模块图里）
    URL.revokeObjectURL(url);
  }
  return {
    dispose: () => {
      try {
        if (typeof cleanup === 'function') cleanup();
      } catch (err) {
        console.error(`[worldforge] 插件 ${record.name} 清理失败`, err);
      }
      reg.unregisterPlugin(record.id);
    },
  };
}

/** 校验插件源码能否解析出 activate 函数（安装前预检） */
export function validatePluginCode(code: string): { ok: boolean; reason?: string } {
  if (!code.trim()) return { ok: false, reason: '插件源码为空' };
  if (!/export\s+(async\s+)?function\s+activate|export\s+default|export\s*\{[^}]*activate/.test(code)) {
    return { ok: false, reason: '未找到 activate 导出；插件需 `export function activate(api)`' };
  }
  return { ok: true };
}
