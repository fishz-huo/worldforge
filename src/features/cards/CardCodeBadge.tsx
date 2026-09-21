/**
 * 卡片编号徽章（卡片详情页顶部）
 * ------------------------------------------------------------------
 * 需求：编号在详情页顶部显示；鼠标移上去出现小铅笔，点开就能改；
 * 改的时候先查重（被占用就标红：「该编号已被【艾拉】使用，请更换」）。
 *
 * 交互都不弹新窗口，就地改：
 *   点铅笔 → 变成输入框（自动选中原编号）→ 回车保存 / Esc 取消 / 点别处也保存。
 *
 * 为什么查重在这里也做一遍：store 里那道校验是最后一道闸（不能跳过），
 * 这一道是为了让用户在**还没提交时**就看到红字，而不是等到保存才被拒绝。
 * 保存后要不要把全库的 [[旧编号]] 一起替换，由 store 询问（见 cardCodeSlice）。
 */
import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Hint } from '@/components/ui/tooltip';
import { codeOf, findCodeConflict, normalizeCode, validateCode } from '@/lib/card-code';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

export function CardCodeBadge({ cardId }: { cardId: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));
  const cards = useStore((s) => s.cards);
  const changeCardCode = useStore((s) => s.changeCardCode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 输入框一出现就聚焦并全选：想整条替换直接打字即可 */
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!card) return null;
  const code = codeOf(card);

  /** 就地校验：格式不对、已被占用都立刻给红字 */
  const problemOf = (value: string): string | null => {
    const next = normalizeCode(value);
    const invalid = validateCode(next);
    if (invalid) return invalid;
    const conflict = findCodeConflict(cards, next, card.id);
    return conflict ? `该编号已被【${conflict.title}】使用，请更换` : null;
  };

  const commit = async () => {
    const problem = problemOf(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setEditing(false);
    setError(null);
    const result = await changeCardCode(card.id, draft);
    if (!result.ok) setError(result.error ?? '编号没有保存成功');
  };

  if (editing) {
    return (
      <span className="flex shrink-0 flex-col gap-0.5">
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit();
            if (e.key === 'Escape') {
              setEditing(false);
              setError(null);
            }
          }}
          onBlur={() => {
            if (!error) void commit();
          }}
          placeholder="如 CHR-001"
          className={cn(
            'h-6 w-28 rounded border bg-transparent px-1.5 font-mono text-[11px] outline-none',
            error ? 'border-destructive text-destructive' : 'border-border focus-visible:border-primary',
          )}
        />
        {error && <span className="max-w-[16rem] text-[10px] leading-tight text-destructive">{error}</span>}
      </span>
    );
  }

  return (
    <Hint
      label={
        code
          ? '编号永久不变：正文里 [[编号]] 永远指向这张卡，标题怎么改都不会断'
          : '这张卡还没有编号。点铅笔补一个，或到「设置 → 世界观 → 卡片编号」一键批量补全'
      }
    >
      <button
        type="button"
        onClick={() => {
          setDraft(code);
          setError(null);
          setEditing(true);
        }}
        className="group flex shrink-0 items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent"
      >
        <span className={cn(code ? 'text-foreground' : 'italic')}>{code || '未编号'}</span>
        <Pencil className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </Hint>
  );
}
