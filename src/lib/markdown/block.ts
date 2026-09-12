/**
 * Markdown 块级解析
 * ------------------------------------------------------------------
 * 支持的块：标题、段落、有序/无序列表（含缩进嵌套）、引用、围栏代码、
 * 分隔线、表格。足够覆盖世界观设定与小说正文的写作需求，且产物极小。
 */
import type { Card } from '@/types';
import { escapeHtml, renderInline } from './inline';

/** 渲染选项 */
export interface RenderOptions {
  /** 标题 → 卡片索引，用于双链解析与关键词自动关联 */
  index?: Map<string, Card>;
  /** 是否启用「提到标题即高亮」 */
  autoLink?: boolean;
}

/** 判断是否列表项 */
function listMatch(line: string): { indent: number; ordered: boolean; text: string } | null {
  const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
  if (!m) return null;
  return { indent: m[1].replace(/\t/g, '  ').length, ordered: /\d/.test(m[2]), text: m[3] };
}

/** 解析缩进列表（递归处理嵌套层级） */
function renderList(lines: string[], start: number, opts: RenderOptions): { html: string; next: number } {
  const first = listMatch(lines[start])!;
  const baseIndent = first.indent;
  const ordered = first.ordered;
  const items: string[] = [];
  let i = start;
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    // 列表项内部可能还有嵌套列表：第一行是内容，其余行递归解析
    const [head, ...rest] = current;
    const nested: string[] = [];
    let k = 0;
    while (k < rest.length) {
      if (listMatch(rest[k])) {
        const sub = renderList(rest, k, opts);
        nested.push(sub.html);
        k = sub.next;
      } else {
        nested.push(`<p>${renderInline(rest[k].trim(), opts.index, opts.autoLink !== false)}</p>`);
        k += 1;
      }
    }
    items.push(
      `<li>${renderInline(head, opts.index, opts.autoLink !== false)}${nested.join('')}</li>`,
    );
    current = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      // 空行后若下一行仍是同级列表项，则继续；否则结束
      const nextItem = lines[i + 1] ? listMatch(lines[i + 1]) : null;
      if (nextItem && nextItem.indent >= baseIndent) {
        i += 1;
        continue;
      }
      break;
    }
    const item = listMatch(line);
    if (item && item.indent === baseIndent) {
      flush();
      current = [item.text];
      i += 1;
      continue;
    }
    if (item && item.indent > baseIndent) {
      // 交给嵌套解析
      current.push(line);
      i += 1;
      continue;
    }
    if (/^\s+\S/.test(line) && current.length) {
      current.push(line.trim());
      i += 1;
      continue;
    }
    break;
  }
  flush();
  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.join('')}</${tag}>`, next: i };
}

/** 解析表格 */
function renderTable(lines: string[], start: number, opts: RenderOptions): { html: string; next: number } {
  const cells = (line: string) =>
    line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = cells(lines[start]);
  let i = start + 2;
  const rows: string[][] = [];
  while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
    rows.push(cells(lines[i]));
    i += 1;
  }
  const inline = (t: string) => renderInline(t, opts.index, opts.autoLink !== false);
  return {
    html:
      `<table><thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>` +
      `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`,
    next: i,
  };
}

/** 渲染整篇 Markdown */
export function renderMarkdown(text: string, opts: RenderOptions = {}): string {
  const autoLink = opts.autoLink !== false;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, '').trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(`<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    // 空行
    if (!line.trim()) {
      i += 1;
      continue;
    }
    // 标题
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const id = `h-${heading[2].trim().replace(/\s+/g, '-')}`;
      out.push(`<h${level} id="${escapeHtml(id)}">${renderInline(heading[2].trim(), opts.index, autoLink)}</h${level}>`);
      i += 1;
      continue;
    }
    // 分隔线
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      out.push('<hr />');
      i += 1;
      continue;
    }
    // 引用（连续多行合并）
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${renderMarkdown(body.join('\n'), opts)}</blockquote>`);
      continue;
    }
    // 表格（第二行是分隔行才算）
    if (line.includes('|') && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1] ?? '')) {
      const table = renderTable(lines, i, opts);
      out.push(table.html);
      i = table.next;
      continue;
    }
    // 列表
    if (listMatch(line)) {
      const list = renderList(lines, i, opts);
      out.push(list.html);
      i = list.next;
      continue;
    }
    // 段落（连续非空行合并）
    const para: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^\s*(#{1,6}\s|>|```)/.test(lines[i]) && !listMatch(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${renderInline(para.join('\n').trim(), opts.index, autoLink).replace(/\n/g, '<br />')}</p>`);
  }
  return out.join('\n');
}
