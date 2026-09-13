/**
 * 插件宿主桥接（HostBridge 的实现）
 * ------------------------------------------------------------------
 * 插件拿不到 store、也拿不到数据库，只能通过这里暴露的接口干活。
 * 单独成文件的原因：pluginSlice 管「插件的装卸与启用」，而「插件能用宿主哪些能力」
 * 是另一件事，并且随着插口变多会一直长（v0.1 后段加了写盘、打印与文档导出），
 * 混在一个文件里会把 slice 撑过 200 行。
 *
 * 反向依赖提醒：lib 不许 import store，所以写盘/导出这些 lib 能力要在这里被接上。
 */
import type { ExportSource, PluginDocExportAPI, PluginFileAPI } from '@/types';
import type { HostBridge } from '@/lib/plugin/host';
import { pluginsRepo } from '@/lib/db';
import { buildExportFiles } from '@/lib/export/build';
import { summarizeAreas } from '@/lib/export/collect';
import { printDocument } from '@/lib/print-doc';
import { isDesktop, pickDirectory } from '@/lib/save-open';
import { writeFiles } from '@/lib/save-batch';
import { upsert } from '../helpers';
import type { AppStore } from '../types';

/**
 * 组装一份导出源数据：当前世界观 + 当前分支 + 相关实体。
 * 快照式（一次性取引用）：导出过程中即使用户在别处改了数据，导出的也是同一时刻的一致内容。
 */
export function exportSourceOf(store: AppStore): ExportSource {
  const world = store.worlds.find((w) => w.id === store.currentWorldId);
  const branch = store.branches.find((b) => b.id === store.currentBranchId);
  return {
    worldName: world?.name ?? '未命名世界观',
    branchName: branch?.name ?? '',
    branchId: store.currentBranchId,
    exportedAt: Date.now(),
    cards: store.cards,
    docs: store.docs,
    outlineNodes: store.outlineNodes,
    tags: store.tags,
    cardTags: store.cardTags,
    relations: store.relations,
  };
}

/** 写盘与打印能力：桌面端直写、网页端下载，差异全在 lib 里屏蔽掉 */
function fileBridge(): PluginFileAPI {
  return {
    canPickDirectory: () => isDesktop(),
    pickDirectory: (defaultPath) => pickDirectory(defaultPath),
    writeFiles: (files, dir) => writeFiles(files, dir),
    printDocument: (html, title) => printDocument(html, title),
  };
}

/** 文档导出能力：采集与排版都在宿主侧，插件只说「要哪些」 */
function docExportBridge(get: () => AppStore): PluginDocExportAPI {
  return {
    areas: () => summarizeAreas(exportSourceOf(get())),
    build: (request) => buildExportFiles(exportSourceOf(get()), request),
  };
}

/** 构造宿主桥接：把 store 的能力以最小接口形式暴露给插件 */
export function makeBridge(get: () => AppStore, set: (partial: Partial<AppStore>) => void): HostBridge {
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
    files: fileBridge(),
    docExport: docExportBridge(get),
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
