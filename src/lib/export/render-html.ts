/**
 * 文档导出：打印用 HTML（PDF 走这条路）
 * ==================================================================
 * 为什么 PDF 不用第三方库自己画：中文字体没法随包分发，自己排版要么体积爆炸、
 * 要么换台机器就变方框。而软件本身就是个浏览器内核，让它按「预览」的规则排版再
 * 打印成 PDF，字形、断行、分页都是系统级正确的结果 —— 这也是唯一能保证
 * 「PDF 长得跟预览一样」的做法。
 *
 * 于是这里的产物是「一段 HTML」，由宿主塞进 #wf-print-root（见 lib/print-doc.ts）：
 *   - 正文复用预览用的 renderMarkdown + .md-body 样式，所见即所得；
 *   - 正文里的标题整体降两级，免得正文的 h1 和条目名平起平坐；
 *   - 卡片正文里的 asset: 图片换成一行说明，避免导出文件里出现死链。
 */
import { countWords, renderMarkdown } from '@/lib/markdown';
import { escapeHtml } from '@/lib/markdown/inline';
import { buildTitleIndex } from '@/lib/query';
import { AREA_HINTS, type ExportArea, type ExportItem, type ExportSource } from '@/types';
import { formatTime } from './format';

/** 条目数超过这个值时，正文前加一份目录 */
const TOC_THRESHOLD = 8;

/**
 * 正文标题整体降级（h1 → h3 …），让它们待在条目标题之下。
 * 开标签与闭标签都要改：只改开标签会留下 `<h3>…</h5>` 这种错配，
 * 浏览器虽然会自行纠正，但 Word 与 PDF 转换器未必。
 */
export function shiftHeadings(html: string, by = 2): string {
  return html.replace(/<(\/?)h([1-6])(\s|>)/g, (_m, slash: string, level: string, tail: string) =>
    `<${slash}h${Math.min(6, Number(level) + by)}${tail}`);
}

/** 卡片正文里引用本地图片时渲染出的 <img src="asset:xxx"> 换成一行说明 */
function replaceAssetImages(html: string): string {
  return html.replace(/<img[^>]*src="asset:[^"]*"[^>]*>/g, '<span class="wf-img-note">［图片：本文件不含图片，请在软件内查看］</span>');
}

/** 条目正文 Markdown → HTML（与预览同一套解析器） */
function bodyToHtml(markdown: string, source: ExportSource): string {
  if (!markdown.trim()) return '';
  const index = buildTitleIndex(source.cards);
  // autoLink 关掉：预览里「提到卡片标题就加下划线」是交互提示，打印出来只是噪音。
  // 外链图片（https:）照旧渲染，本地图库图片（asset:）换文字说明，避免打印出死图。
  const html = renderMarkdown(markdown, { index, autoLink: false });
  return replaceAssetImages(shiftHeadings(html));
}

/** 一个条目 → HTML 片段 */
export function itemToHtml(item: ExportItem, source: ExportSource, index: number): string {
  const parts = [`<section class="wf-item" data-item="${index + 1}">`];
  parts.push(`<h1 class="wf-item-title">${escapeHtml(item.title)}</h1>`);
  if (item.subtitle) parts.push(`<p class="wf-item-sub">${escapeHtml(item.subtitle)}</p>`);
  if (item.meta.length) {
    parts.push('<dl class="wf-meta">');
    item.meta.forEach((m) => parts.push(`<dt>${escapeHtml(m.label)}</dt><dd>${escapeHtml(m.value)}</dd>`));
    parts.push('</dl>');
  }
  const body = bodyToHtml(item.markdown, source);
  if (body) parts.push(`<div class="md-body">${body}</div>`);
  if (item.tags.length) {
    parts.push(`<p class="wf-line"><span>标签</span>${item.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</p>`);
  }
  if (item.relations.length) {
    parts.push(`<p class="wf-line"><span>关联</span>${escapeHtml(item.relations.join('；'))}</p>`);
  }
  parts.push('</section>');
  return parts.join('\n');
}

/** 目录（条目多时给一份，方便在一份长文档里找到位置） */
function tocToHtml(area: ExportArea): string {
  const items = area.items
    .map((it, i) => `<li><b>${i + 1}</b>${escapeHtml(it.title)}</li>`)
    .join('');
  // 按章节分页的区域，目录之后也要另起一页（样式见 index.css 的打印区）
  const cls = area.pageBreakPerItem ? 'wf-toc wf-toc-break' : 'wf-toc';
  return `<section class="${cls}"><h2>目录</h2><ol>${items}</ol></section>`;
}

/**
 * 整个区域 → 可直接打印的 HTML 片段。
 * 返回的是「片段」而不是完整文档：它会被塞进当前页面的 #wf-print-root，
 * 这样就能直接用软件自己的字体、字号与打印样式，不必再造一套。
 */
export function areaToPrintHtml(area: ExportArea, source: ExportSource): string {
  const words = area.items.reduce((sum, it) => sum + countWords(it.markdown), 0);
  const meta = [
    `导出于 ${formatTime(source.exportedAt)}`,
    `${area.items.length} 条 · 约 ${words} 字`,
    source.branchId && source.branchName ? `当前分支：${source.branchName}` : '',
  ].filter(Boolean);
  const parts = [
    // wf-pages：按章节分页的区域（正文/大纲）每个条目另起一页，样式见 index.css 的打印区
    `<article class="wf-doc${area.pageBreakPerItem ? ' wf-pages' : ''}">`,
    '<header class="wf-doc-head">',
    `<div class="wf-kicker">WorldForge · ${escapeHtml(area.title)}</div>`,
    `<h1 class="wf-doc-title">${escapeHtml(source.worldName)}</h1>`,
    `<p class="wf-doc-sub">${escapeHtml(AREA_HINTS[area.id])}</p>`,
    `<p class="wf-doc-meta">${escapeHtml(meta.join(' · '))}</p>`,
    '</header>',
  ];
  if (area.items.length > TOC_THRESHOLD) parts.push(tocToHtml(area));
  area.items.forEach((item, i) => parts.push(itemToHtml(item, source, i)));
  parts.push('</article>');
  return parts.join('\n');
}

/** 单个条目 → 可打印 HTML（拆分导出成多个 PDF 时用） */
export function itemFileToPrintHtml(area: ExportArea, item: ExportItem, source: ExportSource): string {
  const head = [
    '<article class="wf-doc">',
    '<header class="wf-doc-head">',
    `<div class="wf-kicker">WorldForge · ${escapeHtml(area.title)}</div>`,
    `<h1 class="wf-doc-title">${escapeHtml(source.worldName)}</h1>`,
    `<p class="wf-doc-meta">${escapeHtml(`导出于 ${formatTime(source.exportedAt)}`)}</p>`,
    '</header>',
  ].join('\n');
  return `${head}\n${itemToHtml(item, source, 0)}\n</article>`;
}
