/**
 * 文档导出：时间、命名与文本小工具
 * ==================================================================
 * 导出的文件要能在「下载」或某个导出目录里一眼认出是哪一区、哪一天导的，
 * 所以命名统一成 `世界观-区域-时间戳.扩展名`；拆分成多文件时，
 * 用一个同名子目录装起来，条目名前面再加两位序号，保证文件管理器里的顺序与软件里一致。
 */
import { FORMAT_EXT, type ExportArea, type ExportFormat, type ExportSource } from '@/types';

/** 补零 */
const pad = (n: number) => String(n).padStart(2, '0');

/** 时间戳 → 「2025-01-01 12:00」（写进文件头给人看） */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 时间戳 → 「20250101-1200」（写进文件名，可排序） */
export function fileStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * 文件名片段清洗：Windows 不允许 \ / : * ? " < > |，另外首尾空格与点也会出问题。
 * 过长的标题截断到 48 字，避免路径超过系统上限。
 */
export function safeSegment(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
  const trimmed = cleaned.replace(/^[.\s]+|[.\s]+$/g, '');
  const safe = trimmed || '未命名';
  return safe.length > 48 ? safe.slice(0, 48) : safe;
}

/** 一个区域一份文件时的文件名：`世界观-区域-时间戳.md` */
export function mergedFileName(source: ExportSource, area: ExportArea, format: ExportFormat): string {
  return `${safeSegment(source.worldName)}-${safeSegment(area.title)}-${fileStamp(source.exportedAt)}.${FORMAT_EXT[format]}`;
}

/** 拆分成多文件时的子目录名：`世界观-区域-时间戳` */
export function splitDirName(source: ExportSource, area: ExportArea): string {
  return `${safeSegment(source.worldName)}-${safeSegment(area.title)}-${fileStamp(source.exportedAt)}`;
}

/** 拆分时的单个条目文件名：`01-第一章.md`（序号保证顺序） */
export function splitFileName(index: number, title: string, format: ExportFormat): string {
  return `${pad(index + 1)}-${safeSegment(title)}.${FORMAT_EXT[format]}`;
}

/**
 * 正文里的图片替换成一行文字提示。
 * 文字导出（txt / Word / PDF）不搬运图片二进制，若原样留下 `![](asset:xxx)`，
 * 到了别的软件里就是一条死链或一片空白，不如直接写明「这里原本有张图」。
 * Markdown 导出不走这里 —— 那是备份，要原样保留。
 */
export function replaceImages(md: string): string {
  return md.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_m, alt: string) =>
    (alt.trim() ? `［图片：${alt.trim()}］` : '［图片］'));
}
