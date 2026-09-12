/**
 * Markdown 编辑器
 * ------------------------------------------------------------------
 * 写作层与大纲层共用同一个编辑器，做到「零切换」：
 *  - 纯文本 Markdown 输入（不引入重型富文本编辑器，保持产物体积）；
 *  - 工具条一键插入标题 / 列表 / 引用 / 双链 / 图片（见 MarkdownToolbar）；
 *  - 输入 `[[` 自动弹出卡片选择器（见 WikiSuggestPopup）；
 *  - 支持粘贴与拖拽图片，图片存进本地资源库并以 `asset:` 引用。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn, matches } from '@/lib/utils';
import { importImageBlob } from '@/lib/assets';
import { useStore } from '@/store';
import { MarkdownToolbar } from './MarkdownToolbar';
import { WikiSuggestPopup } from './WikiSuggestPopup';

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  /** 工具条右侧附加信息（如「已保存」） */
  footer?: React.ReactNode;
  /** 隐藏字数统计 */
  hideStats?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '开始写作…支持 Markdown，输入 [[ 可引用设定卡片',
  className,
  textareaClassName,
  footer,
  hideStats,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const cards = useStore((s) => s.cards);
  const worldId = useStore((s) => s.currentWorldId);
  const toast = useStore((s) => s.toast);
  const fontSize = useStore((s) => s.editorFontSize);
  const createCard = useStore((s) => s.createCard);
  const [suggest, setSuggest] = useState<{ query: string; start: number } | null>(null);

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
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
  };

  /** 候选卡片 */
  const candidates = useMemo(() => {
    if (!suggest) return [];
    return cards.filter((c) => matches(suggest.query, c.title, c.summary)).slice(0, 8);
  }, [suggest, cards]);

  /** 把 `[[query` 替换成 `[[标题]]` */
  const applySuggestion = (title: string) => {
    if (!suggest) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    onChange(`${value.slice(0, suggest.start)}[[${title}]]${value.slice(caret)}`);
    setSuggest(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = suggest.start + title.length + 4;
      el?.setSelectionRange(pos, pos);
    });
  };

  /** 插入本地图片（粘贴 / 拖拽 / 工具条共用） */
  const insertImage = async (file: File) => {
    if (!worldId) return;
    const asset = await importImageBlob(file, worldId, file.name || '插图.png');
    wrap(`![${asset.name}](asset:${asset.id})`);
    toast('图片已插入并存入本地资源库', 'success');
  };

  /** 光标位置同步（供选择器定位与快捷键使用） */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => setSuggest((s) => s);
    el.addEventListener('keyup', handler);
    return () => el.removeEventListener('keyup', handler);
  }, []);

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <MarkdownToolbar
        value={value}
        footer={footer}
        hideStats={hideStats}
        onWrap={wrap}
        onPrefixLine={prefixLine}
        onPickImage={(file) => void insertImage(file)}
      />

      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onPaste={(e) => {
          const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
          const file = item?.getAsFile();
          if (!file) return;
          e.preventDefault();
          void insertImage(file);
        }}
        onDrop={(e) => {
          const file = e.dataTransfer.files?.[0];
          if (file?.type.startsWith('image/')) {
            e.preventDefault();
            void insertImage(file);
          }
        }}
        onKeyDown={(e) => {
          if (suggest && candidates.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
            e.preventDefault();
            applySuggestion(candidates[0].title);
          } else if (e.key === 'Escape') {
            setSuggest(null);
          } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            wrap('**', '**', '加粗');
          }
        }}
        spellCheck={false}
        placeholder={placeholder}
        style={{ fontSize: `${fontSize}px` }}
        className={cn(
          'min-h-0 flex-1 resize-none bg-transparent px-3 py-2 font-sans leading-7 outline-none',
          'placeholder:text-muted-foreground/60',
          textareaClassName,
        )}
      />

      {suggest && (
        <WikiSuggestPopup
          candidates={candidates}
          query={suggest.query}
          onPick={applySuggestion}
          onCreate={(title) => {
            createCard('concept', { title });
            applySuggestion(title);
          }}
        />
      )}
    </div>
  );
}
