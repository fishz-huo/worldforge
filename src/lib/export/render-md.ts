/**
 * 文档导出：Markdown 渲染
 * ==================================================================
 * Markdown 是「给别的软件看」与「给自己留备份」两头都要顾的格式：
 *   - 文件头写清来源（哪个世界观、哪一区、什么时候导的），日后翻出来能对上号；
 *   - 条目正文**原样保留**用户写的 Markdown，不做标题降级、不重排列表，
 *     这样这份文件本身就能当纯文本备份，甚至能整篇回灌进软件。
 */
import { countWords } from '@/lib/markdown';
import { AREA_HINTS, type ExportArea, type ExportItem, type ExportSource } from '@/types';
import { formatTime } from './format';

/** 条目数超过这个值时，文件头加一份目录（条目少时目录反而碍事） */
const TOC_THRESHOLD = 8;

/** 一个条目的 Markdown：标题 + 属性表 + 正文 + 标签/关联（level=2 时标题用 `##`） */
export function itemToMarkdown(item: ExportItem, level = 2): string {
  const lines = [`${'#'.repeat(level)} ${item.title}`];
  if (item.subtitle) lines.push('', `*${item.subtitle}*`);
  if (item.meta.length) {
    lines.push('');
    item.meta.forEach((m) => lines.push(`- **${m.label}**：${m.value}`));
  }
  const body = item.markdown.trim();
  if (body) lines.push('', body);
  if (item.tags.length) lines.push('', `**标签**：${item.tags.map((t) => `#${t}`).join(' ')}`);
  if (item.relations.length) lines.push('', `**关联**：${item.relations.join('；')}`);
  return lines.join('\n');
}

/** 文件头：标题 + 来源说明（用引用块，任何 Markdown 阅读器都认得） */
export function headerToMarkdown(area: ExportArea, source: ExportSource): string {
  const words = area.items.reduce((sum, it) => sum + countWords(it.markdown), 0);
  const lines = [
    `# ${source.worldName} · ${area.title}`,
    '',
    `> 由 WorldForge 导出 · ${formatTime(source.exportedAt)}`,
    `> 来源：${AREA_HINTS[area.id]}`,
    `> 共 ${area.items.length} 条 · 约 ${words} 字`,
  ];
  if (source.branchId && source.branchName) lines.push(`> 当前分支：${source.branchName}`);
  return lines.join('\n');
}

/** 目录（只列标题，不做锚点跳转：中文锚点在各个编辑器里生成规则不一致） */
function tocToMarkdown(items: ExportItem[]): string {
  const lines = ['## 目录', ''];
  items.forEach((it, i) => lines.push(`${i + 1}. ${it.title}`));
  return lines.join('\n');
}

/** 整个区域 → 一份 Markdown 文件 */
export function areaToMarkdown(area: ExportArea, source: ExportSource): string {
  const parts = [headerToMarkdown(area, source)];
  if (area.items.length > TOC_THRESHOLD) parts.push(tocToMarkdown(area.items));
  area.items.forEach((item) => parts.push(itemToMarkdown(item)));
  return `${parts.join('\n\n')}\n`;
}

/** 单个条目 → 一份 Markdown 文件（拆分导出时用：条目自己就是一级标题） */
export function itemFileToMarkdown(area: ExportArea, item: ExportItem, source: ExportSource): string {
  const head = `> 来自 ${source.worldName} · ${area.title} · 由 WorldForge 导出于 ${formatTime(source.exportedAt)}`;
  return `${head}\n\n${itemToMarkdown(item, 1)}\n`;
}
