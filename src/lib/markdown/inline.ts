/**
 * Markdown 行内语法解析
 * ------------------------------------------------------------------
 * 自行实现而不是引入 marked/markdown-it：产物更小、可控性更强，
 * 并且可以把 [[卡片双链]] 与「关键词自动关联」直接做进解析流程。
 * 安全策略：所有原始文本都会做 HTML 转义，用户输入的标签不会被当成 HTML 执行。
 */
import type { Card } from '@/types';

/** HTML 转义，杜绝注入 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 双链引用 `[[标题]]` / `[[标题|显示文本]]` */
const WIKI_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** HTML 反转义（双链目标在解析前已被转义，查表时要还原） */
export function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
export function extractWikiTargets(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  WIKI_RE.lastIndex = 0;
  while ((m = WIKI_RE.exec(text)) !== null) out.push(m[1].trim());
  return out;
}

/** 生成双链 HTML；找不到对应卡片时标记 is-missing */
function wikiLink(target: string, label: string, index?: Map<string, Card>): string {
  const card = index?.get(unescapeHtml(target));
  const cls = card ? 'wiki-link' : 'wiki-link is-missing';
  const data = card ? ` data-wiki-id="${card.id}"` : '';
  return `<span class="${cls}"${data} data-wiki="${target}" title="${card ? '悬停查看设定卡' : '尚未创建该卡片'}">${label}</span>`;
}

/** 提取文本里所有双链目标（用于「相关卡片」侧栏） */

/** 行内代码占位符：先把代码抠出来，避免内部被其它规则改写 */
const CODE_PLACEHOLDER = '\u0000CODE';

/**
 * 解析一行文本中的行内语法。
 * @param text   原始文本（未转义）
 * @param index  标题 → 卡片索引，用于双链与关键词自动关联
 * @param autoLink 是否启用「正文提到卡片标题就自动加下划线」
 */
export function renderInline(text: string, index?: Map<string, Card>, autoLink = true): string {
  const codes: string[] = [];
  // 1) 抽出行内代码
  let work = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `${CODE_PLACEHOLDER}${codes.length - 1}\u0000`;
  });
  // 2) 转义剩余文本
  work = escapeHtml(work);
  // 3) 图片 ![alt](src)
  work = work.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
    if (!/^(https?:|data:|blob:|asset:|\/)/.test(src)) return escapeHtml(alt);
    return `<img src="${src}" alt="${alt}" loading="lazy" />`;
  });
  // 4) 链接 [text](url)
  work = work.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    if (!/^(https?:|mailto:|#)/.test(href)) return label;
    return `<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`;
  });
  // 5) 双链（此时方括号已被转义为普通字符，需要匹配转义后的形态）
  work = work.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, label?: string) =>
    wikiLink(target.trim(), (label ?? target).trim(), index),
  );
  // 6) 强调
  work = work
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/==([^=]+)==/g, '<mark class="hl-mark">$1</mark>');
  // 7) 关键词自动关联（正文里出现卡片标题即加上下划线，悬停可预览）
  if (autoLink && index && index.size > 0) work = autoLinkTitles(work, index);
  // 8) 还原代码
  work = work.replace(new RegExp(`${CODE_PLACEHOLDER}(\\d+)\u0000`, 'g'), (_m, i: string) => codes[Number(i)] ?? '');
  return work;
}

/** 参与自动关联的最大标题数量，避免超大世界观拖慢渲染 */
const AUTOLINK_LIMIT = 400;

/**
 * 在 HTML 字符串的「纯文本片段」中，把出现过的卡片标题包成双链。
 * 用标签栈跳过 code / pre / a / 已有双链 内部的内容，避免嵌套破坏结构。
 */
export function autoLinkTitles(html: string, index: Map<string, Card>): string {
  const titles = [...index.keys()]
    .filter((t) => t.length >= 2 && t.length <= 40 && !/["'<>]/.test(t))
    .sort((a, b) => b.length - a.length)
    .slice(0, AUTOLINK_LIMIT);
  if (titles.length === 0) return html;
  const pattern = new RegExp(`(${titles.map(escapeRegExp).join('|')})`, 'g');
  /** 不允许自动关联的容器标签 */
  const SKIP = new Set(['code', 'pre', 'a', 'img', 'mark']);
  const stack: string[] = [];
  return html
    .split(/(<[^>]*>)/g)
    .map((segment) => {
      if (segment.startsWith('<')) {
        const close = /^<\s*\/\s*([a-zA-Z0-9]+)/.exec(segment);
        if (close) {
          const idx = stack.lastIndexOf(close[1].toLowerCase());
          if (idx >= 0) stack.splice(idx, 1);
          return segment;
        }
        const open = /^<\s*([a-zA-Z0-9]+)/.exec(segment);
        if (open && !segment.endsWith('/>')) stack.push(open[1].toLowerCase());
        return segment;
      }
      if (stack.some((tag) => SKIP.has(tag))) return segment;
      return segment.replace(pattern, (match) => {
        const card = index.get(match);
        if (!card) return match;
        return `<span class="wiki-link" data-wiki-id="${card.id}" data-wiki="${escapeHtml(match)}" title="悬停查看设定卡">${match}</span>`;
      });
    })
    .join('');
}

/** 正则元字符转义 */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
