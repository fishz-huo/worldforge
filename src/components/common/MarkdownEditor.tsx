/**
 * Markdown 编辑器
 * ------------------------------------------------------------------
 * 写作层与大纲层共用同一个编辑器，做到「零切换」：
 *  - 纯文本 Markdown 输入（不引入重型富文本编辑器，保持产物体积）；
 *  - 工具条一键插入标题 / 列表 / 引用 / 双链 / 图片（见 MarkdownToolbar）；
 *  - 输入 `[[` 自动弹出卡片选择器（见 WikiSuggestPopup）；
 *  - 支持粘贴与拖拽图片，图片存进本地资源库并以 `asset:` 引用；
 *  - 可选的语法着色层（见 MarkdownHighlightLayer）：**只影响显示**，
 *    正文一个字都不改，关掉即回到纯文本。
 * 输入逻辑在 useMarkdownEditing 里，本文件只负责把几块拼起来。
 */
import type { ReactNode } from 'react';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import { MarkdownToolbar } from './MarkdownToolbar';
import { WikiSuggestPopup } from './WikiSuggestPopup';
import { EDITOR_METRICS, MarkdownHighlightLayer } from './MarkdownHighlightLayer';
import { toggleEditorHighlight, useEditorHighlight } from './editorHighlight';
import { useMarkdownEditing } from './useMarkdownEditing';

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  /** 工具条右侧附加信息（如「已保存」） */
  footer?: ReactNode;
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
  const editing = useMarkdownEditing(value, onChange);
  const fontSize = useStore((s) => s.editorFontSize);
  const highlight = useEditorHighlight();

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <MarkdownToolbar
        value={value}
        footer={footer}
        hideStats={hideStats}
        highlight={highlight}
        onToggleHighlight={toggleEditorHighlight}
        onWrap={editing.wrap}
        onPrefixLine={editing.prefixLine}
        onPickImage={(file) => void editing.insertImage(file)}
      />

      {/* 文本区与着色层同处一个定位容器：渲染层要严丝合缝贴在 textarea 的盒子上，
          若相对外层定位，会连工具条一起盖住。 */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {highlight && (
          <MarkdownHighlightLayer text={value} fontSize={fontSize} targetRef={editing.ref} />
        )}

        <textarea
          ref={editing.ref}
          value={value}
          onChange={editing.handleChange}
          onKeyDown={editing.handleKeyDown}
          onPaste={(e) => {
            const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
            const file = item?.getAsFile();
            if (!file) return;
            e.preventDefault();
            void editing.insertImage(file);
          }}
          onDrop={(e) => {
            const file = e.dataTransfer.files?.[0];
            if (file?.type.startsWith('image/')) {
              e.preventDefault();
              void editing.insertImage(file);
            }
          }}
          spellCheck={false}
          placeholder={placeholder}
          style={{
            fontSize: `${fontSize}px`,
            // 开着色时 textarea 自己的字是透明的（只留光标），
            // 而 caret-color 默认跟随 color —— 不显式设回来，光标会一起消失。
            caretColor: highlight ? 'hsl(var(--foreground))' : undefined,
          }}
          className={cn(
            'min-h-0 w-full flex-1 resize-none bg-transparent outline-none',
            EDITOR_METRICS,
            'placeholder:text-muted-foreground/60',
            highlight ? 'text-transparent' : 'text-foreground',
            // 选区配色：浏览器默认的选区底是饱和蓝（实测 #3068d0），会把着色层
            // 按米色纸面配的彩色字压成一片（对比度掉到 1.35~1.95）。
            // 换成主题色淡底后，选中的字仍然读得出来；selection:text-transparent
            // 是防御性写法（Chrome 本就不给 textarea 的选区文字上色）。
            // 透明度必须写成 /[0.18]：18 不在 Tailwind 默认刻度里，写 /18 会
            // 整条规则不生成 —— 而一旦有 ::selection 作者样式，UA 的蓝底就不再
            // 兜底，选区会变成完全透明（实测踩过）。
            highlight && 'selection:bg-primary/[0.18] dark:selection:bg-primary/30 selection:text-transparent',
            textareaClassName,
          )}
        />
      </div>

      {editing.suggest && (
        <WikiSuggestPopup
          candidates={editing.candidates}
          query={editing.suggest.query}
          onPick={editing.applySuggestion}
          onCreate={editing.createFromSuggest}
        />
      )}
    </div>
  );
}
