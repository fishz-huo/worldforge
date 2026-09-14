/**
 * 文档导出：Markdown 渲染
 * ==================================================================
 * Markdown 是「给别的软件看」与「给自己留备份」两头都要顾的格式：
 *   - 文件头写清来源（哪个世界观、哪一区、什么时候导的），日后翻出来能对上号；
 *   - 卡片条目正文前面带一段**属性区**（`---` 围栏），里面是类型 / 结构化字段 /
 *     标签 / 关联。它的排版与界面里「卡片 → 属性区」完全一致，改动可以原样粘回去；
 *   - 条目正文**原样保留**用户写的 Markdown，不做标题降级、不重排列表。
 */
import { countWords } from '@/lib/markdown';
import { AREA_HINTS, type ExportArea, type ExportItem, type ExportSource } from '@/types';
import { formatTime } from './format';
import { cardPropsBlock } from './props';

/** 条目数超过这个值时，文件头加一份目录（条目少时目录反而碍事） */
const TOC_THRESHOLD = 8;

/** 取某个条目的属性区文本；没有（文稿 / 大纲）就返回空串 */
export type PropsOf = (item: ExportItem) => string;

/** 一个条目的 Markdown：标题 + 属性区 + 正文 + 标签/关联（level=2 时标题用 `##`） */
export function itemToMarkdown(item: ExportItem, level = 2, propsOf?: PropsOf): string {
  const lines = [`${'#'.repeat(level)} ${item.title}`];
  const props = item.kind === 'card' ? (propsOf?.(item) ?? '') : '';
  if (props) {
    // 有属性区时不再重复那串 `- **字段**：值`：同一份信息写两遍只会让人改错地方
    lines.push('', props);
  } else if (item.meta.length) {
    if (item.subtitle) lines.push('', `*${item.subtitle}*`);
    lines.push('');
    item.meta.forEach((m) => lines.push(`- **${m.label}**：${m.value}`));
  } else if (item.subtitle) {
    lines.push('', `*${item.subtitle}*`);
  }
  const body = item.markdown.trim();
  if (body) lines.push('', body);
  // 有属性区时标签与关联已经在围栏里，不再重复
  if (!props && item.tags.length) lines.push('', `**标签**：${item.tags.map((t) => `#${t}`).join(' ')}`);
  if (!props && item.relations.length) lines.push('', `**关联**：${item.relations.join('；')}`);
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
export function areaToMarkdown(area: ExportArea, source: ExportSource, propsOf?: PropsOf): string {
  const parts = [headerToMarkdown(area, source)];
  if (area.items.length > TOC_THRESHOLD) parts.push(tocToMarkdown(area.items));
  area.items.forEach((item) => parts.push(itemToMarkdown(item, 2, propsOf)));
  return `${parts.join('\n\n')}\n`;
}

/** 单个条目 → 一份 Markdown 文件（拆分导出时用：条目自己就是一级标题） */
export function itemFileToMarkdown(area: ExportArea, item: ExportItem, source: ExportSource, propsOf?: PropsOf): string {
  const head = `> 来自 ${source.worldName} · ${area.title} · 由 WorldForge 导出于 ${formatTime(source.exportedAt)}`;
  return `${head}\n\n${itemToMarkdown(item, 1, propsOf)}\n`;
}

/** 由导出源生成「条目 → 属性区」的取用函数（卡片才有的那段） */
export function propsResolver(source: ExportSource): PropsOf {
  return (item) => {
    const card = source.cards.find((c) => c.id === item.id);
    if (!card) return '';
    return cardPropsBlock(card, source);
  };
}
