/**
 * 备份格式校验（导入前预检）
 * ------------------------------------------------------------------
 * 导入是「覆盖现有数据」的操作，所以宁可提前拒绝，也不要写到一半才失败。
 * 这里只做「能不能用」的判断：结构对不对、实体数量是否合理，
 * 不做字段级校验 —— 字段级正确性由写库时的事务保证（出错整体回滚）。
 *
 * 与 parseBackup 的分工：
 *   parseBackup  —— 只判断「是不是 WorldForge 导出的文件」；
 *   inspectBackup —— 判断「内容是否可用」，并给出人能看懂的问题清单。
 */
import type { SnapshotPayload } from '@/types';

/** 导入预检结果 */
export interface BackupInspection {
  ok: boolean;
  /** 能看懂的问题描述（空数组表示没问题） */
  problems: string[];
  /** 备份里的数据规模，用于确认对话框 */
  stats: {
    worldName: string;
    cards: number;
    tags: number;
    relations: number;
    maps: number;
    entries: number;
    docs: number;
    outlineNodes: number;
    branches: number;
    assets: number;
  };
}

/** 文件体积上限：超过这个大小基本都是内嵌图片，解析会占用大量内存 */
export const MAX_BACKUP_BYTES = 128 * 1024 * 1024;

/** 需要校验「是数组」的实体列 */
const ARRAY_KEYS: (keyof SnapshotPayload)[] = [
  'branches', 'cards', 'tags', 'cardTags', 'relations', 'maps', 'pins',
  'regions', 'tracks', 'entries', 'eras', 'docs', 'outlineNodes',
];

/**
 * 这份文件能不能用（给 UI 用的一站式判断）。
 * 把「解析」与「预检」合成一步，页面只要调它一次就知道该报错还是该弹确认框。
 */
export interface BackupCheck {
  ok: boolean;
  /** 失败原因（人能看懂，直接可以 toast） */
  error?: string;
  /** 预检细节（ok 时才有意义） */
  inspection?: BackupInspection;
}

/**
 * 解析并预检一份备份文本。
 * @param parse parseBackup（由调用方注入，避免这个模块反向依赖 backup.ts）
 */
export function checkBackupText(
  text: string,
  parse: (text: string) => { snapshot: SnapshotPayload; assets?: unknown[] } | null,
): BackupCheck {
  const backup = parse(text);
  if (!backup) return { ok: false, error: '文件格式不正确：需要 WorldForge 导出的 JSON 备份' };
  const inspection = inspectSnapshot(backup.snapshot, backup.assets?.length ?? 0);
  if (!inspection.ok) return { ok: false, error: `这份备份不可用：${inspection.problems.join('；')}` };
  return { ok: true, inspection };
}

/** 从任意对象里安全读字符串 */
function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * 检查快照内容是否可用。
 * @param payload 已解析的快照
 * @param assetCount 文件里内嵌的图片数量（backup.assets?.length）
 */
export function inspectSnapshot(payload: SnapshotPayload, assetCount = 0): BackupInspection {
  const problems: string[] = [];
  const world = (payload.world ?? null) as Record<string, unknown> | null;

  ARRAY_KEYS.forEach((key) => {
    if (!Array.isArray(payload[key])) problems.push(`缺少或损坏的数据段：${String(key)}`);
  });
  if (!payload.world || typeof payload.world !== 'object') {
    problems.push('文件里没有世界观信息（world 段），无法确定这套设定属于谁');
  }
  if (problems.length === 0 && payload.cards.length === 0) {
    problems.push('这份备份里一张卡片都没有，导入后仍然会是空的');
  }

  return {
    ok: problems.length === 0,
    problems,
    stats: {
      worldName: str(world?.name, '（未命名世界观）'),
      cards: payload.cards?.length ?? 0,
      tags: payload.tags?.length ?? 0,
      relations: payload.relations?.length ?? 0,
      maps: payload.maps?.length ?? 0,
      entries: payload.entries?.length ?? 0,
      docs: payload.docs?.length ?? 0,
      outlineNodes: payload.outlineNodes?.length ?? 0,
      branches: payload.branches?.length ?? 0,
      assets: assetCount,
    },
  };
}

/**
 * 把预检结果压成一句人能读的话，用于确认对话框与错误提示。
 * 例：世界观「猫猫的冒险」：48 张卡片、7 个标签、16 条关联、2 张地图。
 */
export function describeBackup(inspection: BackupInspection): string {
  const s = inspection.stats;
  const parts = [
    `${s.cards} 张卡片`,
    `${s.tags} 个标签`,
    `${s.relations} 条关联`,
    `${s.maps} 张地图`,
    `${s.entries} 个时间轴条目`,
    `${s.docs} 篇文稿`,
  ];
  if (s.assets > 0) parts.push(`${s.assets} 张图片`);
  return `世界观「${s.worldName}」：${parts.join('、')}`;
}

/**
 * 把导入过程中的异常翻译成用户能看懂的提示。
 * 数据库错误（SQLite constraint / NOT NULL 等）直接抛给用户没有意义，
 * 这里统一改写成「文件可能损坏 + 数据未改动」的说明。
 */
export function explainImportError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/NOT NULL|constraint|no such column|no such table|datatype/i.test(raw)) {
    return `备份内容与当前版本的表结构不匹配，已回滚（你的数据没有被改动）。技术细节：${raw}`;
  }
  return `导入失败，已回滚（你的数据没有被改动）。技术细节：${raw}`;
}
