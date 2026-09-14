/**
 * 界面偏好持久化（localStorage）
 * ------------------------------------------------------------------
 * 与世界观数据无关的「界面状态」放在 localStorage：
 * 读写同步、启动零延迟，不占用 SQLite 快照体积。
 */
import type { ModuleKey } from './types';

const KEY = 'worldforge.prefs';

/** 界面缩放的档位（档位制而非无级滑杆：每一档都保证排版正常） */
export type UiScale = 0.85 | 1 | 1.15 | 1.3;

/** 界面缩放的可选档位与显示名；设置面板与文档都读这里，避免两处各写一份 */
export const UI_SCALE_OPTIONS: { value: UiScale; label: string }[] = [
  { value: 0.85, label: '紧凑' },
  { value: 1, label: '标准' },
  { value: 1.15, label: '较大' },
  { value: 1.3, label: '最大' },
];

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
  /** 左侧次级侧栏宽度（rem，=16px 的倍数） */
  sidebarWidth: number;
  /** 右侧检查器宽度（rem） */
  inspectorWidth: number;
  /** 整界面缩放倍率 */
  uiScale: UiScale;
}

/** 面板宽度的极限值：避免出现「拖到 40px 宽打不开」的死局 */
export const WIDTH_LIMITS = {
  sidebar: { min: 12, max: 30 },
  inspector: { min: 18, max: 40 },
} as const;

/**
 * 把宽度钳制到区间内。
 * 放在 prefs 而不是 layout-sync，是为了让 store 只依赖「偏好定义」，
 * 不依赖「DOM 同步」那个模块 —— 否则 store 里会混进一件它不该关心的事。
 */
export function clampWidth(value: number, limit: { min: number; max: number }): number {
  //  Infinity 是「太大了」而不是「没有值」：往回夹到上限，否则会写成 12rem，
  //  用户看到的是「明明往右拖，侧栏却缩到最窄」这种莫名其妙的反应。
  if (value === Infinity) return limit.max;
  if (value === -Infinity) return limit.min;
  if (!Number.isFinite(value)) return limit.min; // NaN：没有可用的值，用下限最安全
  return Math.min(limit.max, Math.max(limit.min, Math.round(value * 100) / 100));
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
  // 16rem = 256px、20rem = 320px，与改造前的 w-64 / w-80 完全一致
  sidebarWidth: 16,
  inspectorWidth: 20,
  uiScale: 1,
};

/** 读取偏好（容错：解析失败回落默认值，数值越界一律夹回合法区间） */
export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const merged = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
    return sanitizePrefs(merged);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/**
 * 把读回来的偏好修成合法值。
 * localStorage 是用户可以手改的（也可能被旧版本、被别的分支写脏）：
 * 宽度跑成 0 会让侧栏消失不见，缩放跑成 0 会让界面空白 —— 这两件事
 * 用户自己都修不回来（设置面板也在那个空白的界面里），所以必须在入口挡住。
 */
export function sanitizePrefs(prefs: Prefs): Prefs {
  return {
    ...prefs,
    sidebarWidth: clampWidth(prefs.sidebarWidth, WIDTH_LIMITS.sidebar),
    inspectorWidth: clampWidth(prefs.inspectorWidth, WIDTH_LIMITS.inspector),
    uiScale: UI_SCALE_OPTIONS.some((o) => o.value === prefs.uiScale) ? prefs.uiScale : DEFAULT_PREFS.uiScale,
  };
}

/** 写入偏好（去抖由调用方保证，这里同步写足够快） */
export function savePrefs(prefs: Partial<Prefs>): void {
  try {
    // 合并后再过一遍 sanitize：拖拽途中的中间值也可能越界
    const merged = sanitizePrefs({ ...loadPrefs(), ...prefs });
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
