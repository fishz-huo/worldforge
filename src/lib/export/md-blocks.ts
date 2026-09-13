/**
 * Markdown → Word 文档块（行内片段 + 块级结构）
 * ------------------------------------------------------------------
 * 问题：Word 不能像浏览器那样直接吃 Markdown，导出前必须先把原文拆成
 * 「带格式的行内片段」和「块级结构」，再由 docx.ts 翻译成 OOXML。
 *
 * 为什么这样设计：
 *   1. 块级规则与 src/lib/markdown/block.ts（软件内预览用的解析器）对齐：同一批正则、
 *      同一套行为，预览里什么样、导出到 Word 里就什么样，不会「所见非所得」。
 *   2. 行内解析用「粘性正则 + 游标」的扫描器，而不是套一串 replace：扫描器天然能处理
 *      反斜杠转义与不成对的标记（`**粗体` 少一个星号时原样当普通文字，绝不吞字）。
 *   3. 只产出纯数据（DocSpan / DocBlock），不碰 DOM 也不碰 OOXML，可以在 Node 里自测。
 */
import type { DocBlock, DocSpan } from '@/types';

/* 行内语法的粘性正则（y 标志）：只从游标处精确匹配，命中才前进 */
const RE_CODE = /`([^`]+)`/y;
const RE_WIKI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/y;
const RE_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/y;
const RE_BOLD = /\*\*([\s\S]+?)\*\*/y;
const RE_ITALIC = /\*([^*\s][^*\n]*?)\*/y;
const RE_UNDERSCORE = /_([^_\s][^_\n]*?)_/y;
const RE_STRIKE = /~~([\s\S]+?)~~/y;

/** 列表项匹配：与 markdown/block.ts 的 listMatch 完全一致（- * + 以及 1. / 1)） */
function listMatch(line: string): { indent: number; ordered: boolean; text: string } | null {
  const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
  if (!m) return null;
  return { indent: m[1].replace(/\t/g, '  ').length, ordered: /\d/.test(m[2]), text: m[3] };
}

/** 表格分隔行（|---|:--:| 这类），与 block.ts 用同一条正则 */
function isTableDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line);
}

/** 拆一行表格的单元格：去掉首尾竖线再按 | 切 */
function tableCells(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

/** 行首是否为块级起始：段落合并在这些地方断开（与 block.ts 的段落循环一致） */
function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i];
  if (/^\s*(#{1,6}\s|>|```)/.test(line) || listMatch(line)) return true;
  if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) return true;
  return line.includes('|') && isTableDivider(lines[i + 1] ?? '');
}

/** 给一组片段统一加粗 / 倾斜（`**粗体**` 内部还能再套 `_斜体_`） */
function mark(spans: DocSpan[], bold: boolean, italic: boolean): DocSpan[] {
  return spans.map((span) => ({
    text: span.text,
    bold: span.bold || bold || undefined,
    italic: span.italic || italic || undefined,
    code: span.code,
  }));
}

/**
 * 把一行 Markdown 拆成行内片段：`**粗体**`、`*斜体*` / `_斜体_`、`` `代码` ``、
 * `[文字](链接)`（保留文字丢链接）、`[[标题]]` / `[[标题|显示名]]`（保留显示名）、
 * `~~删除线~~`（去掉标记只留文字）、反斜杠转义；不成对的标记原样当普通文字。
 */
export function parseSpans(text: string): DocSpan[] {
  const spans: DocSpan[] = [];
  let buffer = '';
  let i = 0;
  /** 冲掉普通文字缓冲，再追加若干片段（相邻文字始终留在同一个片段里） */
  const emit = (...values: DocSpan[]) => {
    if (buffer) spans.push({ text: buffer });
    buffer = '';
    spans.push(...values);
  };
  /** 命中粘性正则就推进游标；每次匹配前重设 lastIndex，因此递归调用也安全 */
  const take = (re: RegExp): RegExpExecArray | null => {
    re.lastIndex = i;
    const m = re.exec(text);
    if (m) i = re.lastIndex;
    return m;
  };
  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) { buffer += text[i + 1]; i += 2; continue; } // 反斜杠转义
    const code = take(RE_CODE);
    if (code) { emit({ text: code[1], code: true }); continue; } // 行内代码：内部不再解析
    const wiki = take(RE_WIKI);
    if (wiki) { buffer += (wiki[2] ?? wiki[1]).trim(); continue; } // 双链：Word 里没有跳转，只留显示名
    const link = take(RE_LINK);
    if (link) { buffer += link[1]; continue; } // 链接：保留文字、丢掉地址
    const bold = take(RE_BOLD); // 内容递归解析，所以 `**粗 _斜_**` 两层格式都带得上
    if (bold) { emit(...mark(parseSpans(bold[1]), true, false)); continue; }
    // 斜体开符前不能是单词字符或另一个 *：否则 `2*3`、未闭合的 `**` 会被误当成斜体
    const prev = i > 0 ? text[i - 1] : '';
    const italic = (!/[\w*]/.test(prev) && take(RE_ITALIC)) || (!/\w/.test(prev) && take(RE_UNDERSCORE));
    if (italic) { emit(...mark(parseSpans(italic[1]), false, true)); continue; }
    const strike = take(RE_STRIKE); // 删除线：DocSpan 没有这个字段，去掉 ~~ 当普通文字
    if (strike) { buffer += strike[1]; continue; }
    buffer += text[i]; // 普通字符：不成对的标记也落到这里，原样保留，绝不吞字
    i += 1;
  }
  emit();
  return spans;
}

/** Markdown 原文 → 块级元素数组（空行跳过；先归一化 \r\n；行为与预览解析对齐） */
export function toDocBlocks(markdown: string): DocBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: DocBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 围栏代码块：开栏到闭栏之间的内容原样保留（含缩进与空行）
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i += 1; }
      i += 1; // 跳过闭栏行；没有闭栏行时会越过末尾，循环随即结束
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }
    if (!line.trim()) { i += 1; continue; } // 空行
    const heading = /^(#{1,6})\s+(.*)$/.exec(line); // 标题
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, spans: parseSpans(heading[2].trim()) });
      i += 1;
      continue;
    }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { blocks.push({ kind: 'divider' }); i += 1; continue; }
    // 引用：连续多行合并成一段
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, '').trim()); i += 1; }
      blocks.push({ kind: 'quote', spans: parseSpans(body.join(' ')) });
      continue;
    }
    // 表格：本行含 | 且下一行是分隔行
    if (line.includes('|') && isTableDivider(lines[i + 1] ?? '')) {
      const header = tableCells(line).map(parseSpans);
      i += 2; // 跨过表头行与分隔行
      const rows: DocSpan[][][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) { rows.push(tableCells(lines[i]).map(parseSpans)); i += 1; }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }
    // 列表：缩进的子项直接追加到同一串 items 末尾，不建多层嵌套结构
    const first = listMatch(line);
    if (first) {
      const items: DocSpan[][] = [];
      while (i < lines.length) {
        const item = listMatch(lines[i]);
        if (item) { items.push(parseSpans(item.text)); i += 1; continue; }
        if (!lines[i].trim() && listMatch(lines[i + 1] ?? '')) { i += 1; continue; } // 列表中间的空行
        if (/^\s+\S/.test(lines[i]) && items.length > 0) { // 续行并到上一项末尾
          items[items.length - 1] = [...items[items.length - 1], { text: ' ' }, ...parseSpans(lines[i].trim())];
          i += 1;
          continue;
        }
        break;
      }
      blocks.push({ kind: 'list', ordered: first.ordered, items });
      continue;
    }
    // 段落：连续非空、且不是块起始的行合并（行间保留 \n，docx 侧渲染成 <w:br/>）
    const para: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) { para.push(lines[i]); i += 1; }
    blocks.push({ kind: 'para', spans: parseSpans(para.join('\n')) });
  }
  return blocks;
}
