/**
 * 文档导出：纯文本渲染
 * ==================================================================
 * .txt 是兼容性最好的格式（记事本、手机自带阅读器、剪贴板都能吃），
 * 代价是没有样式，所以这里用「版面」补：标题加书名号、引用加竖线、
 * 表格用 | 对齐、条目之间用横线隔开，尽量在等宽/非等宽字体下都读得下去。
 *
 * 行内标记（**粗体**、`代码`、[[双链]]）复用 Word 侧的行内解析器去掉，
 * 保证 .txt 与 .docx 里出现的是同一段文字，不会一处多字一处少字。
 */
import { countWords } from '@/lib/markdown';
import { AREA_HINTS, type ExportArea, type ExportItem, type ExportSource } from '@/types';
import { parseSpans } from './md-blocks';
import { formatTime, replaceImages } from './format';

const RULE = '='.repeat(64); // 文件抬头用
const THIN = '-'.repeat(64); // 条目分隔用

/** 去掉行内标记，得到纯文字 */
export function stripInline(text: string): string {
  return parseSpans(text).map((s) => s.text).join('');
}

/** Markdown 正文 → 纯文本：保留块结构（列表符号、引用线、表格分栏），去掉标记符号 */
export function markdownToPlainText(md: string): string {
  const out: string[] = [];
  let inCode = false; // 代码块里的内容原样输出，不动里面的符号

  replaceImages(md).replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
    if (/^\s*```/.test(line)) {
      inCode = !inCode; // 围栏行本身不输出
      return;
    }
    if (inCode) {
      out.push(line);
      return;
    }
    if (!line.trim()) {
      out.push('');
      return;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = stripInline(heading[2]);
      // 一二级标题加书名号，缩进体现层级
      out.push('', `${'  '.repeat(Math.max(0, level - 1))}${level <= 2 ? `【${text}】` : text}`, '');
      return;
    }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      out.push(THIN);
      return;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      out.push(`  ｜ ${stripInline(quote[1])}`);
      return;
    }
    const list = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[2]);
      out.push(`${list[1]}${ordered ? `${list[2].replace(/[.)]$/, '')}.` : '-'} ${stripInline(list[3])}`);
      return;
    }
    if (line.includes('|')) {
      // 表格：分隔行换成虚线，其余按列拼回去
      if (/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line)) {
        out.push(THIN);
        return;
      }
      const cells = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => stripInline(c.trim()));
      out.push(cells.join(' | '));
      return;
    }
    out.push(stripInline(line));
  });

  // 压掉连续空行：Markdown 里为了排版常有两个以上空行，纯文本里会显得很空
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 一个条目 → 纯文本（横线分隔 + 属性行 + 正文） */
export function itemToPlainText(item: ExportItem, index: number): string {
  const lines = [THIN, `  ${index + 1}. ${item.title}`];
  if (item.subtitle) lines.push(`  ${item.subtitle}`);
  lines.push(THIN, '');
  item.meta.forEach((m) => lines.push(`${m.label}：${m.value}`));
  if (item.meta.length) lines.push('');
  const body = markdownToPlainText(item.markdown);
  if (body) lines.push(body, '');
  if (item.tags.length) lines.push(`标签：${item.tags.map((t) => `#${t}`).join(' ')}`);
  if (item.relations.length) lines.push(`关联：${item.relations.join('；')}`);
  return lines.join('\n');
}

/** 区域抬头 + 全部条目 */
export function areaToPlainText(area: ExportArea, source: ExportSource): string {
  const words = area.items.reduce((sum, it) => sum + countWords(it.markdown), 0);
  const head = [
    RULE,
    `  ${source.worldName} · ${area.title}`,
    RULE,
    `由 WorldForge 导出 · ${formatTime(source.exportedAt)}`,
    `来源：${AREA_HINTS[area.id]}`,
    `共 ${area.items.length} 条 · 约 ${words} 字`,
    '（本文件为纯文本，正文里的 Markdown 标记已去掉；需要保留标记请导出 Markdown）',
  ];
  const body = area.items.map((it, i) => itemToPlainText(it, i)).join('\n\n');
  return `${head.join('\n')}\n\n${body}\n`;
}

/** 单个条目 → 一份 .txt 文件（拆分导出） */
export function itemFileToPlainText(area: ExportArea, item: ExportItem, source: ExportSource): string {
  const head = `${RULE}\n  ${item.title}\n${RULE}\n来自 ${source.worldName} · ${area.title} · 导出于 ${formatTime(source.exportedAt)}\n`;
  const body = itemToPlainText(item, 0);
  return `${head}\n${body}\n`;
}
