/**
 * 世界观体系（World）与平行世界分支（Branch）
 * ------------------------------------------------------------------
 * - World 是最顶层容器：一套世界设定 = 一个 world。
 * - Branch 是同一 world 下的平行世界口径（如「主世界」「if 线：主角未觉醒」），
 *   卡片、地图、时间轴、文稿都可以挂到某个分支；branch_id 为空表示属于主世界。
 */
import type { Id, JsonText, Stamps, Timestamp } from './common';

/** 时间轴配置：定义这个世界观的"年"怎么读、怎么显示 */
export interface TimeConfig {
  /** 刻度单位名，例如「年」「纪元」「星历」 */
  unit: string;
  /** 零点称呼，例如「创世元年」 */
  zeroLabel: string;
  /** 是否允许负刻度（创世之前） */
  allowNegative: boolean;
  /** 时间轴默认显示范围（数值刻度） */
  defaultStart: number;
  defaultEnd: number;
  /** 角色年龄的默认换算：刻度差 * factor = 岁 */
  ageFactor: number;
}

/** world.meta 中承载的扩展配置 */
export interface WorldMeta {
  time?: TimeConfig;
  /** 自定义主题色（插件可覆盖） */
  accent?: string;
  [key: string]: unknown;
}

/** 世界观体系 */
export interface World extends Stamps {
  id: Id;
  name: string;
  description: string;
  meta: WorldMeta;
}

/** 平行世界分支 */
export interface Branch extends Stamps {
  id: Id;
  world_id: Id;
  name: string;
  description: string;
  /** 分支标签色，用于时间轴 / 卡片角标 */
  color: string;
  /** 与主世界的分歧点描述，例如「第 245 年，主角拒绝继承王位」 */
  divergence: string;
  /** 分歧发生的刻度，便于在时间轴上标注 */
  divergence_t: number | null;
  /** 由哪个分支 fork 而来（溯源用） */
  forked_from: Id | null;
}

/** 新建 world 时的默认时间配置 */
export const DEFAULT_TIME_CONFIG: TimeConfig = {
  unit: '年',
  zeroLabel: '纪元元年',
  allowNegative: true,
  defaultStart: 0,
  defaultEnd: 1000,
  ageFactor: 1,
};

/** 分支调色板：新建分支时按序取色 */
export const BRANCH_COLORS = [
  '#8b5cf6',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#a3a3a3',
];

/** 从 meta 中安全读取时间配置（缺失字段用默认值补齐） */
export function readTimeConfig(meta: WorldMeta | undefined): TimeConfig {
  return { ...DEFAULT_TIME_CONFIG, ...(meta?.time ?? {}) };
}

/** 数据库行 → 领域对象时需要剔除的原始列类型（供仓储层使用） */
export type WorldRow = Omit<World, 'meta'> & { meta: JsonText; created_at: Timestamp };
