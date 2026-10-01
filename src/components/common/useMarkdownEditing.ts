/**
 * Markdown 编辑器的输入逻辑
 * ------------------------------------------------------------------
 * 从 MarkdownEditor 拆出来：那边只留「工具条 + 文本区 + 渲染层 + 双链弹层」的布局，
 * 输入相关的行为（包裹语法、行首前缀、`[[` 识别、图片插入、快捷键）都在这里，
 * 两边各自保持短小、也各自只关心一件事。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { Card } from '@/types';
import { matches } from '@/lib/utils';
import { wikiRefOf } from '@/lib/card-code';
import { importImageBlob } from '@/lib/assets';
import { useStore } from '@/store';

/** 双链候选的唤起状态 */
interface SuggestState {
  query: string;
  start: number;
}

export function useMarkdownEditing(value: string, onChange: (next: string) => void) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const cards = useStore((s) => s.cards);
  const worldId = useStore((s) => s.currentWorldId);
  const toast = useStore((s) => s.toast);
  const createCard = useStore((s) => s.createCard);
  const [suggest, setSuggest] = useState<SuggestState | null>(null);

  /** 在光标处包裹 / 插入文本 */
  const wrap = useCallback(
    (before: string, after = '', placeholderText = '文本') => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end) || placeholderText;
      onChange(value.slice(0, start) + before + selected + after + value.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + before.length, start + before.length + selected.length);
      });
    },
    [onChange, value],
  );

  /** 行首插入前缀（标题、列表、引用） */
  const prefixLine = useCallback(
    (prefix: string) => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + prefix.length, start + prefix.length);
      });
    },
    [onChange, value],
  );

  /** 输入时判断是否唤起了双链选择器 */
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      onChange(next);
      const caret = e.target.selectionStart ?? 0;
      const before = next.slice(0, caret);
      const open = before.lastIndexOf('[[');
      const close = before.lastIndexOf(']]');
      if (open > -1 && open > close && caret - open <= 30) {
        setSuggest({ query: before.slice(open + 2), start: open });
      } else {
        setSuggest(null);
      }
    },
    [onChange],
  );

  /** 候选卡片：标题与编号都能搜；编号完全命中的排最前（回车即中） */
  const candidates = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.trim().toLowerCase();
    return cards
      .filter((c) => matches(suggest.query, c.title, c.code, c.summary))
      .sort((a, b) => Number((b.code ?? '').toLowerCase() === q) - Number((a.code ?? '').toLowerCase() === q))
      .slice(0, 8);
  }, [suggest, cards]);

  /** 把 `[[query` 替换成 `[[编号|标题]]`（未编号的卡片退回 `[[标题]]`） */
  const applySuggestion = useCallback(
    (card: Card) => {
      if (!suggest) return;
      const el = ref.current;
      const caret = el?.selectionStart ?? value.length;
      const link = wikiRefOf(card);
      onChange(`${value.slice(0, suggest.start)}${link}${value.slice(caret)}`);
      setSuggest(null);
      requestAnimationFrame(() => {
        el?.focus();
        const pos = suggest.start + link.length;
        el?.setSelectionRange(pos, pos);
      });
    },
    [onChange, suggest, value],
  );

  /** 候选里没有的卡片：回车即建一张概念卡，并立刻引用它 */
  const createFromSuggest = useCallback(
    (title: string) => applySuggestion(createCard('concept', { title })),
    [applySuggestion, createCard],
  );

  /** 插入本地图片（粘贴 / 拖拽 / 工具条共用） */
  const insertImage = useCallback(
    async (file: File) => {
      if (!worldId) return;
      const asset = await importImageBlob(file, worldId, file.name || '插图.png');
      wrap(`![${asset.name}](asset:${asset.id})`);
      toast('图片已插入并存入本地资源库', 'success');
    },
    [worldId, wrap, toast],
  );

  /** 快捷键：先给双链候选让路，Esc 收候选，Ctrl/Cmd+B 加粗 */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (suggest && candidates.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
        e.preventDefault();
        applySuggestion(candidates[0]);
      } else if (e.key === 'Escape') {
        setSuggest(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        wrap('**', '**', '加粗');
      }
    },
    [applySuggestion, candidates, suggest, wrap],
  );

  return {
    ref,
    suggest,
    candidates,
    wrap,
    prefixLine,
    handleChange,
    applySuggestion,
    createFromSuggest,
    insertImage,
    handleKeyDown,
  };
}
