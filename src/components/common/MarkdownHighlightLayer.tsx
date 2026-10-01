/**
 * Markdown 语法着色的只读渲染层
 * ------------------------------------------------------------------
 * 叠在 textarea 之上、`pointer-events-none`，只负责「显示带颜色的语法」。
 * 它与 textarea 之间唯一的契约就是**排版度量完全一致**，所以：
 *   · 两层共用下面这一个 EDITOR_METRICS 常量，谁都不许再各写一份；
 *   · 只切区间、包 span，**绝不增删字符**（字符数一变，折行点就变）；
 *   · 只改颜色，不改字形宽度（不加 font-weight、不用 italic，
 *     否则折行点漂移 = 与 textarea 错位）；
 *   · 宽度要按 textarea 的滚动条宽度补偿（否则右侧多出约 15px 可用宽）。
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { cn } from '@/lib/utils';
import { parseHighlight } from '@/lib/markdown/highlight';
import type { MdLine, MdLineKind, MdTokenKind } from '@/lib/markdown/highlight';

/**
 * 两层共用的排版度量。
 * textarea 与渲染层都必须带上它，且**不许单独覆盖 font-size / line-height /
 * padding / 空白规则 / 断词规则** —— 字号由调用方以 inline style 同时给两层。
 */
export const EDITOR_METRICS = 'px-3 py-2 font-sans leading-7 whitespace-pre-wrap break-words';

/** 区间配色：亮色 / 暗色各一套，全部用 Tailwind 默认调色板（不动 index.css） */
const TONE: Record<MdTokenKind, string> = {
  heading: 'text-sky-600 dark:text-sky-400',
  marker: 'text-sky-600 dark:text-sky-400',
  bold: 'text-red-500 dark:text-red-400',
  italic: 'text-rose-800 dark:text-rose-300',
};

/** 行配色：列表正文整体压成深紫蓝，其余行用默认前景色 */
const LINE_TONE: Record<MdLineKind, string> = {
  plain: '',
  heading: '',
  ul: 'text-indigo-800 dark:text-indigo-200',
  ol: 'text-indigo-800 dark:text-indigo-200',
};

/** 把一行的区间切成 span；区间之外的原样输出（字符一个不多、一个不少） */
function renderLine(line: MdLine, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  line.tokens.forEach((token) => {
    if (token.start > cursor) out.push(line.text.slice(cursor, token.start));
    out.push(
      <span key={`${key}-${token.start}`} className={TONE[token.kind]}>
        {line.text.slice(token.start, token.end)}
      </span>,
    );
    cursor = token.end;
  });
  if (cursor < line.text.length) out.push(line.text.slice(cursor));
  return out;
}

interface Props {
  text: string;
  /** 与 textarea 用同一个值（store 的 editorFontSize） */
  fontSize: number;
  /** 底下那个 textarea：滚动位置与滚动条宽度都从它身上量 */
  targetRef: RefObject<HTMLTextAreaElement>;
  className?: string;
}

export function MarkdownHighlightLayer({ text, fontSize, targetRef, className }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => parseHighlight(text), [text]);

  /**
   * 对齐：把渲染层右侧让出 textarea 滚动条的宽度，并跟随它的滚动位置。
   * 滚动条宽度一律**实测**（offsetWidth - clientWidth，再扣掉边框），不硬编码。
   */
  const sync = useCallback(() => {
    const el = targetRef.current;
    const layer = layerRef.current;
    const inner = innerRef.current;
    if (!el || !layer || !inner) return;
    const cs = getComputedStyle(el);
    const gutter =
      el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    layer.style.right = `${Math.max(0, gutter)}px`;
    inner.style.transform = `translateY(${-el.scrollTop}px)`;
  }, [targetRef]);

  // 每次渲染后重新对齐：换行数变了、滚动条出现/消失，都会影响它
  useEffect(() => {
    sync();
  });

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    el.addEventListener('scroll', sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [sync, targetRef]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute bottom-0 left-0 top-0 select-none overflow-hidden',
        EDITOR_METRICS,
        className,
      )}
      style={{ fontSize: `${fontSize}px` }}
    >
      <div ref={innerRef}>
        {lines.map((line, index) => (
          <div key={index} className={cn('min-h-7', LINE_TONE[line.kind])}>
            {renderLine(line, String(index))}
          </div>
        ))}
      </div>
    </div>
  );
}
