/**
 * Markdown 编辑器工具条
 * ------------------------------------------------------------------
 * 从 MarkdownEditor 拆出来，让「编辑器主体」与「工具栏」各自保持短小。
 * 所有按钮都只做一件事：在光标处插入或包裹 Markdown 语法。
 */
import {
  Bold, Code2, Heading2, Image as ImageIcon, Italic, Link2, List, ListOrdered,
  Minus, Quote, ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { countWords, readingMinutes } from '@/lib/markdown';

interface Props {
  onWrap: (before: string, after?: string, placeholder?: string) => void;
  onPrefixLine: (prefix: string) => void;
  onPickImage: (file: File) => void;
  /** 当前文本，用于字数统计 */
  value: string;
  hideStats?: boolean;
  /** 右侧附加信息 */
  footer?: React.ReactNode;
}

export function MarkdownToolbar({ onWrap, onPrefixLine, onPickImage, value, hideStats, footer }: Props) {
  /** 小按钮工厂，避免重复 JSX */
  const ToolBtn = ({
    icon: Ico,
    label,
    onClick,
  }: {
    icon: typeof Bold;
    label: string;
    onClick: () => void;
  }) => (
    <Hint label={label}>
      <Button variant="ghost" size="icon-sm" onClick={onClick} type="button">
        <Ico />
      </Button>
    </Hint>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-0.5">
      <ToolBtn icon={Heading2} label="标题" onClick={() => onPrefixLine('## ')} />
      <ToolBtn icon={Bold} label="加粗 (Ctrl+B)" onClick={() => onWrap('**', '**', '加粗')} />
      <ToolBtn icon={Italic} label="斜体" onClick={() => onWrap('*', '*', '斜体')} />
      <ToolBtn icon={List} label="无序列表" onClick={() => onPrefixLine('- ')} />
      <ToolBtn icon={ListOrdered} label="有序列表" onClick={() => onPrefixLine('1. ')} />
      <ToolBtn icon={Quote} label="引用" onClick={() => onPrefixLine('> ')} />
      <ToolBtn icon={Code2} label="行内代码" onClick={() => onWrap('`', '`', 'code')} />
      <ToolBtn icon={Minus} label="分隔线" onClick={() => onWrap('\n---\n')} />
      <ToolBtn icon={Link2} label="插入链接" onClick={() => onWrap('[', '](https://)', '链接文字')} />
      <ToolBtn icon={ScrollText} label="引用设定卡 [[…]]" onClick={() => onWrap('[[', ']]', '卡片标题')} />

      <label className="inline-flex">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickImage(file);
            e.target.value = '';
          }}
        />
        <Hint label="插入图片（也可直接粘贴 / 拖入）">
          <span className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-accent">
            <ImageIcon className="size-3.5" />
          </span>
        </Hint>
      </label>

      <div className="ml-auto flex items-center gap-2 pr-1 text-[10px] text-muted-foreground">
        {!hideStats && (
          <>
            <span>{countWords(value)} 字</span>
            <span>约 {readingMinutes(value)} 分钟</span>
          </>
        )}
        {footer}
      </div>
    </div>
  );
}
