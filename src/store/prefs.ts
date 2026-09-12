/**
 * 界面偏好持久化（localStorage）
 * ------------------------------------------------------------------
 * 与世界观数据无关的「界面状态」放在 localStorage：
 * 读写同步、启动零延迟，不占用 SQLite 快照体积。
 */
import type { ModuleKey } from './types';

const KEY = 'worldforge.prefs';

/** 可持久化的界面偏好 */
export interface Prefs {
  theme: 'dark' | 'light';
  accent: string;
  railOpen: boolean;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  module: ModuleKey;
  /** 卡片库一次显示多少列 */
  cardColumns: 2 | 3 | 4;
  /** 分支视图口径 */
  branchScope: 'current' | 'all';
  /** 编辑器分栏模式 */
  editorSplit: boolean;
  /** 编辑器字号 */
  editorFontSize: number;
}

/** 默认偏好 */
export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  accent: '262 83% 58%',
  railOpen: true,
  sidebarOpen: true,
  inspectorOpen: true,
  module: 'cards',
  cardColumns: 3,
  branchScope: 'current',
  editorSplit: true,
  editorFontSize: 15,
};

/** 读取偏好（容错：解析失败回落默认值） */
export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** 写入偏好（去抖由调用方保证，这里同步写足够快） */
export function savePrefs(prefs: Partial<Prefs>): void {
  try {
    const merged = { ...loadPrefs(), ...prefs };
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略即可 */
  }
}

/** 清空偏好 */
export function clearPrefs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
