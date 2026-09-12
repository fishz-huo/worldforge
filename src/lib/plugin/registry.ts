/**
 * 插件注册表
 * ------------------------------------------------------------------
 * 宿主对外暴露的「插口」集合：卡片类型、字段、面板、命令、主题、导出器、卡片动作。
 * 插件激活时往这里注册，停用时按 pluginId 一次性注销。
 * 用 useSyncExternalStore 订阅，保证注册变化能触发 React 重渲染。
 */
import type {
  CardTypeDef, FieldDef, PluginCardActionDef, PluginCommandDef,
  PluginExporterDef, PluginPanelDef, ThemeDef,
} from '@/types';
import { BUILTIN_CARD_TYPES } from '@/types';

/** 带来源标记的注册项 */
export type Owned<T> = T & { pluginId: string; pluginName: string };

/** 注册表状态（不可变更新，便于 useSyncExternalStore 比较） */
export interface RegistryState {
  cardTypes: Owned<CardTypeDef>[];
  extraFields: Owned<{ cardType: string; field: FieldDef }>[];
  panels: Owned<PluginPanelDef>[];
  commands: Owned<PluginCommandDef>[];
  cardActions: Owned<PluginCardActionDef>[];
  themes: Owned<ThemeDef>[];
  exporters: Owned<PluginExporterDef>[];
}

const EMPTY: RegistryState = {
  cardTypes: [], extraFields: [], panels: [], commands: [], cardActions: [], themes: [], exporters: [],
};

let state: RegistryState = EMPTY;
const listeners = new Set<() => void>();

/** 订阅注册表变化 */
export function subscribeRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 读取当前注册表快照（引用稳定） */
export function getRegistry(): RegistryState {
  return state;
}

/** 通知订阅者 */
function emit(next: Partial<RegistryState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** 注册新卡片类型 */
export function registerCardType(def: CardTypeDef, pluginId: string, pluginName: string) {
  emit({ cardTypes: [...state.cardTypes, { ...def, pluginId, pluginName }] });
}

/** 为已有类型追加字段 */
export function registerCardField(cardType: string, field: FieldDef, pluginId: string, pluginName: string) {
  emit({ extraFields: [...state.extraFields, { cardType, field, pluginId, pluginName }] });
}

/** 注册侧边面板 */
export function registerPanel(panel: PluginPanelDef, pluginId: string, pluginName: string) {
  emit({ panels: [...state.panels.filter((p) => p.id !== panel.id), { ...panel, pluginId, pluginName }] });
}

/** 注册命令 */
export function registerCommand(cmd: PluginCommandDef, pluginId: string, pluginName: string) {
  emit({ commands: [...state.commands.filter((c) => c.id !== cmd.id), { ...cmd, pluginId, pluginName }] });
}

/** 注册卡片动作 */
export function registerCardAction(action: PluginCardActionDef, pluginId: string, pluginName: string) {
  emit({ cardActions: [...state.cardActions.filter((a) => a.id !== action.id), { ...action, pluginId, pluginName }] });
}

/** 注册主题 */
export function registerTheme(theme: ThemeDef, pluginId: string, pluginName: string) {
  emit({ themes: [...state.themes.filter((t) => t.id !== theme.id), { ...theme, fromPlugin: pluginId, pluginId, pluginName }] });
}

/** 注册导出器 */
export function registerExporter(exporter: PluginExporterDef, pluginId: string, pluginName: string) {
  emit({ exporters: [...state.exporters.filter((e) => e.id !== exporter.id), { ...exporter, pluginId, pluginName }] });
}

/** 注销某个插件的全部注册项 */
export function unregisterPlugin(pluginId: string): void {
  emit({
    cardTypes: state.cardTypes.filter((x) => x.pluginId !== pluginId),
    extraFields: state.extraFields.filter((x) => x.pluginId !== pluginId),
    panels: state.panels.filter((x) => x.pluginId !== pluginId),
    commands: state.commands.filter((x) => x.pluginId !== pluginId),
    cardActions: state.cardActions.filter((x) => x.pluginId !== pluginId),
    themes: state.themes.filter((x) => x.pluginId !== pluginId),
    exporters: state.exporters.filter((x) => x.pluginId !== pluginId),
  });
}

/** 清空全部插件注册（重置时使用） */
export function clearRegistry(): void {
  emit(EMPTY);
}

/* ------------------------------ 组合视图 ------------------------------ */

/** 全部可用卡片类型 = 内置 + 插件注册（插件类型额外带 pluginName 便于 UI 标注） */
export function listCardTypes(): (CardTypeDef & { pluginName?: string })[] {
  return [...BUILTIN_CARD_TYPES, ...state.cardTypes];
}

/** 查找卡片类型定义（找不到时回落到 note，保证 UI 不崩） */
export function getCardType(type: string): CardTypeDef {
  return (
    BUILTIN_CARD_TYPES.find((t) => t.type === type) ??
    state.cardTypes.find((t) => t.type === type) ??
    BUILTIN_CARD_TYPES[BUILTIN_CARD_TYPES.length - 1]
  );
}

/** 某类型的完整字段列表 = 内置字段 + 插件追加字段 */
export function getFieldsFor(type: string): FieldDef[] {
  const base = getCardType(type).fields;
  const extra = state.extraFields.filter((f) => f.cardType === type).map((f) => f.field);
  return [...base, ...extra];
}

/** 主题列表 */
export function listThemes(): Owned<ThemeDef>[] {
  return state.themes;
}
