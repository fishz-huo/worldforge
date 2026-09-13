/**
 * 文档导出：编排（区域 → 一组待写盘的文件）
 * ==================================================================
 * 把「采集 → 渲染」串起来，并决定文件怎么切、叫什么名字：
 *   - 默认一个区域一份文件（需求：不同区域分别导出，不合并成一个文件）；
 *   - 勾了「每个条目一个文件」时，一区一个同名子目录，条目文件带两位序号；
 *   - PDF 不在这里生成字节，而是产出「打印用 HTML」，由宿主走系统打印（选另存为 PDF）。
 * 返回值里 pdf 项只有 html 字段，其余格式是 text 或 bytes，调用方按 format 分派。
 */
import { buildDocx } from './docx';
import { collectAreas } from './collect';
import { parseSpans, toDocBlocks } from './md-blocks';
import { formatTime, mergedFileName, replaceImages, splitDirName, splitFileName } from './format';
import { areaToMarkdown, itemFileToMarkdown } from './render-md';
import { areaToPlainText, itemFileToPlainText } from './render-txt';
import { areaToPrintHtml, itemFileToPrintHtml } from './render-html';
import {
  AREA_HINTS, FORMAT_MIME, type DocBlock, type DocxInput, type ExportArea, type ExportFile,
  type ExportFormat, type ExportItem, type ExportRequest, type ExportSource,
} from '@/types';

/** 条目属性（类型/种族…）在 Word 里排成一个项目符号列表 */
function metaBlock(item: ExportItem): DocBlock | null {
  if (item.meta.length === 0) return null;
  return { kind: 'list', ordered: false, items: item.meta.map((m) => parseSpans(`**${m.label}**：${m.value}`)) };
}

/** 正文标题整体降一级：条目名已经占了一级标题，正文的 `#` 应该是二级 */
function shiftBlockLevels(blocks: DocBlock[], by: number): DocBlock[] {
  return blocks.map((b) => (b.kind === 'heading' ? { ...b, level: Math.min(6, b.level + by) } : b));
}

/** 一个条目 → Word 块序列 */
function itemBlocks(item: ExportItem): DocBlock[] {
  const blocks: DocBlock[] = [{ kind: 'heading', level: 1, spans: parseSpans(item.title) }];
  if (item.subtitle) blocks.push({ kind: 'quote', spans: [{ text: item.subtitle, italic: true }] });
  const meta = metaBlock(item);
  if (meta) blocks.push(meta);
  // 图片不搬二进制，正文里的图片语法先换成文字说明，避免 Word 里出现一片空白
  blocks.push(...shiftBlockLevels(toDocBlocks(replaceImages(item.markdown)), 1));
  if (item.tags.length) blocks.push({ kind: 'para', spans: [{ text: `标签：${item.tags.map((t) => `#${t}`).join(' ')}`, italic: true }] });
  if (item.relations.length) blocks.push({ kind: 'para', spans: [{ text: `关联：${item.relations.join('；')}`, italic: true }] });
  return blocks;
}

/** 区域抬头 + 全部条目 → Word 输入 */
function docxInputFor(area: ExportArea, source: ExportSource): DocxInput {
  const blocks: DocBlock[] = [];
  area.items.forEach((item) => blocks.push(...itemBlocks(item)));
  return {
    title: `${source.worldName} · ${area.title}`,
    subtitle: AREA_HINTS[area.id],
    meta: [
      `由 WorldForge 导出 · ${formatTime(source.exportedAt)}`,
      `共 ${area.items.length} 条`,
      source.branchId && source.branchName ? `当前分支：${source.branchName}` : '',
    ].filter(Boolean),
    blocks,
    pageBreakBeforeHeadings: area.pageBreakPerItem,
  };
}

/** 渲染一份文件（合并导出：一个区域一份） */
async function renderAreaFile(
  area: ExportArea, source: ExportSource, format: ExportFormat,
): Promise<ExportFile> {
  const base = { format, name: mergedFileName(source, area, format), mime: FORMAT_MIME[format] };
  if (format === 'md') return { ...base, text: areaToMarkdown(area, source) };
  if (format === 'txt') return { ...base, text: areaToPlainText(area, source) };
  if (format === 'docx') return { ...base, bytes: await buildDocx(docxInputFor(area, source)) };
  return { ...base, html: areaToPrintHtml(area, source) };
}

/** 渲染一份文件（拆分导出：一个条目一份） */
async function renderItemFile(
  area: ExportArea, item: ExportItem, index: number, source: ExportSource, format: ExportFormat,
): Promise<ExportFile> {
  const base = {
    format,
    name: splitFileName(index, item.title, format),
    subDir: splitDirName(source, area),
    mime: FORMAT_MIME[format],
  };
  if (format === 'md') return { ...base, text: itemFileToMarkdown(area, item, source) };
  if (format === 'txt') return { ...base, text: itemFileToPlainText(area, item, source) };
  if (format === 'docx') {
    const input: DocxInput = {
      title: item.title,
      subtitle: `${source.worldName} · ${area.title}`,
      meta: [`由 WorldForge 导出 · ${formatTime(source.exportedAt)}`, ...item.meta.map((m) => `${m.label}：${m.value}`)],
      blocks: shiftBlockLevels(toDocBlocks(replaceImages(item.markdown)), 1),
      pageBreakBeforeHeadings: false,
    };
    return { ...base, bytes: await buildDocx(input) };
  }
  return { ...base, html: itemFileToPrintHtml(area, item, source) };
}

/** 请求里勾选的区域（保持界面上的固定顺序），并为每个区域算出各自的条目数 */
export function selectedAreas(source: ExportSource, req: ExportRequest): ExportArea[] {
  const wanted = new Set(req.areaIds);
  return collectAreas(source, { includeRelations: req.includeRelations, branchOnly: req.branchOnly })
    .filter((a) => wanted.has(a.id));
}

/**
 * 主入口：按请求产出全部文件。
 * 没有内容时返回空数组（调用方提示用户），不生成空文件。
 */
export async function buildExportFiles(source: ExportSource, req: ExportRequest): Promise<ExportFile[]> {
  const areas = selectedAreas(source, req);
  const formats = req.formats;
  const files: ExportFile[] = [];
  for (const area of areas) {
    for (const format of formats) {
      if (req.split) {
        for (let i = 0; i < area.items.length; i += 1) {
          files.push(await renderItemFile(area, area.items[i], i, source, format));
        }
      } else {
        files.push(await renderAreaFile(area, source, format));
      }
    }
  }
  return files;
}
