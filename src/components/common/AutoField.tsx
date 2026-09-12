/**
 * 自动保存输入控件
 * ------------------------------------------------------------------
 * 世界观编辑里绝大多数操作都是「改一个字」。
 * 这些控件在本地维护输入值（保证光标不跳），去抖后才写库，
 * 从而做到「所见即所改、无需点保存」。
 */
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedCallback } from '@/hooks/useDebounced';
import { cn } from '@/lib/utils';

/** 通用：受控本地状态 + 去抖提交 */
function useDraft<T>(value: T, onCommit: (v: T) => void, delay = 400) {
  const [draft, setDraft] = useState(value);
  const external = useRef(value);
  const commit = useDebouncedCallback(onCommit, delay);

  // 外部值变化（例如切换了卡片）时同步
  useEffect(() => {
    if (value !== external.current) {
      external.current = value;
      setDraft(value);
    }
  }, [value]);

  const update = (next: T) => {
    setDraft(next);
    external.current = next;
    commit(next);
  };
  return [draft, update] as const;
}

/** 单行自动保存输入框 */
export function AutoInput({
  value,
  onCommit,
  className,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useDraft(value, onCommit);
  return (
    <Input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      // 失焦立即落库，避免用户快速切换时丢失最后一次输入
      onBlur={() => onCommit(draft)}
      className={className}
    />
  );
}

/** 多行自动保存文本域 */
export function AutoTextarea({
  value,
  onCommit,
  className,
  minHeight,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  /** 最小高度（像素） */
  minHeight?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useDraft(value, onCommit);
  return (
    <Textarea
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      style={minHeight ? { minHeight } : undefined}
      className={cn('resize-y', className)}
    />
  );
}

/** 数值自动保存输入框；空字符串提交为 null */
export function AutoNumber({
  value,
  onCommit,
  className,
  ...rest
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useDraft(value === null ? '' : String(value), (v) => {
    const trimmed = String(v).trim();
    if (trimmed === '') return onCommit(null);
    const num = Number(trimmed);
    onCommit(Number.isFinite(num) ? num : null);
  });
  return (
    <Input
      {...rest}
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft === '' ? null : Number(draft))}
      className={className}
    />
  );
}
