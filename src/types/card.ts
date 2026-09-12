/**
 * 卡片（Card）—— 世界观设定的最小知识单元
 * ------------------------------------------------------------------
 * 角色 / 地点 / 事件 / 底层逻辑 / 势力 / 物品 / 概念 / 参考资料 / 随笔
 * 共用一张表，差异化信息放进 fields（由 types/field.ts 的 FieldDef 驱动渲染）。
 */
import type { FieldValue, Id, Stamps } from './common';

/** 卡片主实体 */
export interface Card extends Stamps {
  id: Id;
  world_id: Id;
  /** 归属的平行世界分支；null 表示主世界 */
  branch_id: Id | null;
  /** 卡片类型，对应 CardTypeDef.type（可为插件注册的自定义类型） */
  type: string;
  title: string;
  /** 副标题，例如角色的称号、地点的所属国 */
  subtitle: string;
  /** 一句话摘要：卡片列表与悬浮预览都会展示 */
  summary: string;
  /** 正文（Markdown，支持 [[卡片标题]] 双链） */
  body: string;
  /** 差异化字段值 */
  fields: Record<string, FieldValue>;
  /** 封面图资源 id */
  cover_asset: Id | null;
  /** 是否置顶（1 置顶 / 0 普通） */
  pinned: number;
}

/** 卡片图库项：一张卡片可附多张图片（角色形象、设定图…） */
export interface CardAsset {
  id: Id;
  card_id: Id;
  asset_id: Id;
  caption: string;
  order_index: number;
}

/** 卡片 + 标签 + 关联 的聚合视图，供列表与预览使用 */
export interface CardView extends Card {
  tags: string[];
  /** 出边关联数量 */
  relationCount: number;
}

/** 新建卡片时的字段默认值 */
export function emptyCardFields(type: string, defaults: Record<string, FieldValue> = {}) {
  return { ...defaults, __type: type } as Record<string, FieldValue>;
}

/** 读取卡片数值型字段（时间刻度、人口等），非法值返回 null */
export function numField(card: Card, key: string): number | null {
  const raw = card.fields?.[key];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 读取卡片文本型字段 */
export function textField(card: Card, key: string): string {
  const raw = card.fields?.[key];
  if (raw === undefined || raw === null) return '';
  return Array.isArray(raw) ? raw.join('、') : String(raw);
}
