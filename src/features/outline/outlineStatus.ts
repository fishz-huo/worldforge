/**
 * 大纲状态配色（唯一色号来源）
 * ------------------------------------------------------------------
 * 色号由 2026-10-16 无头 Chrome 预览实测确定（.probe/outline-preview.cjs）：
 * 构思 amber / 写作中 blue / 已完成 emerald / 已废弃 slate + 删除线，
 * 亮暗各一套 —— 八组「字/底」对比度全部 ≥ 4.5（亮 8.15 / 8.49 / 8.57 / 6.92，
 * 暗 12.03 / 10.34 / 11.81 / 5.71），描边用来在浅色底（羊皮纸）上勾出边界。
 * 一律用 Tailwind 类、不写 inline hex，插件主题（深海 / 羊皮纸）切换时不用额外适配。
 */
import { OUTLINE_STATUS, type OutlineStatus } from '@/types';

/** 色块外壳：底色只包文字（换行后每行片段各自带底色）+ 1px 内描边 */
export const CHIP_BASE = 'box-decoration-clone rounded-sm px-1 py-0.5 font-medium ring-1 ring-inset';

/** 标题色块：亮 / 暗 */
const CHIP: Record<OutlineStatus, string> = {
  idea: 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800',
  draft: 'bg-blue-100 text-blue-900 ring-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800',
  done: 'bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800',
  cut: 'bg-slate-100 text-slate-600 ring-slate-300 line-through dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600',
};

/** 左侧小色点（比色块饱和一档，缩得很小时也分得清） */
const DOT: Record<OutlineStatus, string> = {
  idea: 'bg-amber-500 dark:bg-amber-400',
  draft: 'bg-blue-500 dark:bg-blue-400',
  done: 'bg-emerald-500 dark:bg-emerald-400',
  cut: 'bg-slate-400 dark:bg-slate-500',
};

export interface StatusStyle {
  status: OutlineStatus;
  /** 文案只有一处真相源：types 里的 OUTLINE_STATUS */
  label: string;
  /** 带外壳的完整色块类名 */
  chip: string;
  dot: string;
}

/** 状态 → 样式；未知状态回落到第一个（构思），老数据不会出现「没有底色」 */
export function statusStyle(status: string | undefined): StatusStyle {
  const found = OUTLINE_STATUS.find((s) => s.status === status) ?? OUTLINE_STATUS[0];
  return { status: found.status, label: found.label, chip: `${CHIP_BASE} ${CHIP[found.status]}`, dot: DOT[found.status] };
}

/** 点色点时的下一个状态（按 OUTLINE_STATUS 的顺序循环） */
export function nextStatus(status: string | undefined): OutlineStatus {
  const index = OUTLINE_STATUS.findIndex((s) => s.status === status);
  return OUTLINE_STATUS[(index + 1) % OUTLINE_STATUS.length].status;
}
