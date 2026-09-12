/**
 * Plugin Slice —— 插件的安装、启用、停用、卸载与设置
 * ------------------------------------------------------------------
 * 需求 14：插件区 + 插件插口。
 * 数据落在 plugins 表；运行时句柄（已激活的模块）保存在模块级 Map 里，
 * 停用时调用 dispose 注销注册项与事件订阅，做到「可插可拔」。
 */
import type { PluginRecord } from '@/types';
import { newPluginId } from '@/lib/id';
import { pluginsRepo } from '@/lib/db';
import { BUILTIN_PLUGINS } from '@/lib/plugin/builtins';
import { loadPlugin, validatePluginCode, type HostBridge, type PluginHandle } from '@/lib/plugin/host';
import { clearRegistry, unregisterPlugin } from '@/lib/plugin/registry';
import { upsert } from '../helpers';
import type { AppStore, Slice } from '../types';

/** 已激活插件句柄： pluginId → handle */
const handles = new Map<string, PluginHandle>();

export interface PluginSlice {
  /** 首次启动时把内置示例插件写入数据库（停用状态由用户决定） */
  ensureBuiltinPlugins: () => void;
  /** 从源码安装插件，返回是否成功 */
  installPlugin: (code: string, meta?: Partial<PluginRecord>) => Promise<boolean>;
  /** 启用 / 停用插件 */
  setPluginEnabled: (id: string, enabled: boolean) => Promise<void>;
  /** 卸载插件 */
  removePlugin: (id: string) => void;
  /** 更新插件设置 */
  updatePluginSettings: (id: string, settings: Record<string, unknown>) => void;
  /** 激活所有已启用的插件（启动流程末尾调用） */
  activatePlugins: () => Promise<void>;
}

/** 构造宿主桥接：把 store 的能力以最小接口形式暴露给插件 */
function makeBridge(get: () => AppStore, set: (partial: Partial<AppStore>) => void): HostBridge {
  return {
    query: {
      listCards: () => get().cards,
      getCard: (id) => get().cards.find((c) => c.id === id),
      listTags: () => get().tags,
      listRelations: () => get().relations,
      listDocs: () => get().docs,
      currentWorldId: () => get().currentWorldId,
      currentBranchId: () => get().currentBranchId,
    },
    toast: (message, kind = 'info') => get().toast(message, kind),
    readSettings: (pluginId) => get().plugins.find((p) => p.id === pluginId)?.settings ?? {},
    saveSettings: (pluginId, settings) => {
      const record = get().plugins.find((p) => p.id === pluginId);
      if (!record) return;
      const next = { ...record, settings };
      pluginsRepo.save(next);
      set({ plugins: upsert(get().plugins, next) });
    },
    /** 插件声明的设置结构只需回填一次：已有结构就不再覆盖，避免冲掉用户看到过的表单 */
    applyManifest: (pluginId, schema) => {
      const record = get().plugins.find((p) => p.id === pluginId);
      if (!record || Object.keys(record.settings_schema).length > 0) return;
      const next = { ...record, settings_schema: schema };
      pluginsRepo.save(next);
      set({ plugins: upsert(get().plugins, next) });
    },
  };
}

export const createPluginSlice: Slice<PluginSlice> = (set, get) => ({
  ensureBuiltinPlugins: () => {
    const existing = new Set(pluginsRepo.list().map((p) => p.id));
    const missing = BUILTIN_PLUGINS.filter((p) => !existing.has(p.id));
    if (missing.length === 0) return;
    missing.forEach((p, i) => {
      const record: PluginRecord = {
        id: p.id,
        name: p.name,
        version: '0.1.0',
        author: 'WorldForge 内置示例',
        description: p.description,
        code: p.code,
        // 默认启用与否由内置清单自己声明（避免用下标判断，加插件时容易错位）
        enabled: p.defaultEnabled ? 1 : 0,
        builtin: 1,
        settings_schema: {},
        settings: {},
        created_at: Date.now() + i,
      };
      pluginsRepo.save(record);
    });
    set({ plugins: pluginsRepo.list(undefined, undefined, 'created_at ASC') });
  },

  installPlugin: async (code, meta = {}) => {
    const check = validatePluginCode(code);
    if (!check.ok) {
      get().toast(check.reason ?? '插件格式不正确', 'error');
      return false;
    }
    const record: PluginRecord = {
      id: meta.id ?? newPluginId(),
      name: meta.name ?? '未命名插件',
      version: meta.version ?? '0.1.0',
      author: meta.author ?? '未知作者',
      description: meta.description ?? '',
      code,
      enabled: 1,
      builtin: meta.builtin ?? 0,
      settings_schema: meta.settings_schema ?? {},
      settings: meta.settings ?? {},
      created_at: Date.now(),
    };
    // 先落库再激活，激活失败也能在列表里看到并排查
    pluginsRepo.save(record);
    set({ plugins: upsert(get().plugins, record) });
    try {
      const handle = await loadPlugin(record, makeBridge(get, set));
      handles.set(record.id, handle);
      get().toast(`插件「${record.name}」已载入`, 'success');
      return true;
    } catch (err) {
      console.error('[worldforge] 插件载入失败', err);
      const failed = { ...record, enabled: 0 };
      pluginsRepo.save(failed);
      set({ plugins: upsert(get().plugins, failed) });
      get().toast(`插件载入失败：${err instanceof Error ? err.message : String(err)}`, 'error');
      return false;
    }
  },

  setPluginEnabled: async (id, enabled) => {
    const record = get().plugins.find((p) => p.id === id);
    if (!record) return;
    const next = { ...record, enabled: enabled ? 1 : 0 };
    pluginsRepo.save(next);
    set({ plugins: upsert(get().plugins, next) });

    if (!enabled) {
      handles.get(id)?.dispose();
      handles.delete(id);
      get().toast(`已停用「${record.name}」`, 'info');
      return;
    }
    try {
      const handle = await loadPlugin(next, makeBridge(get, set));
      handles.set(id, handle);
      get().toast(`已启用「${record.name}」`, 'success');
    } catch (err) {
      console.error('[worldforge] 插件启用失败', err);
      pluginsRepo.save({ ...next, enabled: 0 });
      set({ plugins: upsert(get().plugins, { ...next, enabled: 0 }) });
      get().toast('插件启用失败，请检查源码', 'error');
    }
  },

  removePlugin: (id) => {
    handles.get(id)?.dispose();
    handles.delete(id);
    unregisterPlugin(id);
    pluginsRepo.remove(id);
    set({ plugins: get().plugins.filter((p) => p.id !== id) });
    get().toast('插件已卸载', 'warn');
  },

  updatePluginSettings: (id, settings) => {
    const record = get().plugins.find((p) => p.id === id);
    if (!record) return;
    const next = { ...record, settings };
    pluginsRepo.save(next);
    set({ plugins: upsert(get().plugins, next) });
  },

  activatePlugins: async () => {
    clearRegistry();
    handles.forEach((h) => h.dispose());
    handles.clear();
    const enabled = get().plugins.filter((p) => p.enabled === 1);
    for (const record of enabled) {
      try {
        handles.set(record.id, await loadPlugin(record, makeBridge(get, set)));
      } catch (err) {
        console.error(`[worldforge] 插件 ${record.name} 激活失败`, err);
      }
    }
  },
});
