/**
 * Markdown 渲染入口 + 文本统计工具
 */
import { renderInline, extractWikiTargets } from './inline';
import { renderMarkdown } from './block';

export { renderMarkdown, renderInline, extractWikiTargets };
export type { RenderOptions } from './block';

/** 去掉 Markdown 标记，得到纯文本（用于摘要、搜索、字数统计） */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, a: string, b?: string) => b ?? a)
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_~=]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 统计字数：中日韩按字计，西文按词计。
 * 这是中文写作者最习惯的口径（也用在插件示例里）。
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const words = (text.replace(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, ' ').match(/[A-Za-z0-9'’-]+/g) ?? []).length;
  return cjk + words;
}

/** 字符数（含标点） */
export function countChars(text: string): number {
  return text.replace(/\s/g, '').length;
}

/** 取正文前 N 个字的纯文本摘要 */
export function excerpt(md: string, length = 80): string {
  const plain = stripMarkdown(md);
  return plain.length > length ? `${plain.slice(0, length)}…` : plain;
}

/** 估算阅读时间（分钟），按 400 字/分钟 */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(countWords(text) / 400));
}

/** 从 Markdown 中提取全部标题，用于大纲导航 */
export function extractHeadings(md: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  md.split(/\r?\n/).forEach((line) => {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].trim() });
  });
  return out;
}
