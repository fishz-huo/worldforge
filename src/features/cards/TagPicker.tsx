/**
 * 标签选择器
 * ------------------------------------------------------------------
 * 需求 11：tag 内容自由填写 + 按 tag 筛选。
 * 支持直接输入新标签（回车创建），点选已有标签切换。
 */
import { useMemo, useState } from 'react';
import { Check, Plus, Tag as TagIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dot } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

/** 某张卡片的标签编辑器 */
export function TagPicker({ cardId }: { cardId: string }) {
  const tags = useStore((s) => s.tags);
  const cardTags = useStore((s) => s.cardTags);
  const setCardTagsOf = useStore((s) => s.setCardTagsOf);
  const ensureTag = useStore((s) => s.ensureTag);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedIds = useMemo(
    () => cardTags.filter((ct) => ct.card_id === cardId).map((ct) => ct.tag_id),
    [cardTags, cardId],
  );
  const selected = tags.filter((t) => selectedIds.includes(t.id));
  const available = tags.filter(
    (t) => !selectedIds.includes(t.id) && t.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const toggle = (tagId: string) => {
    setCardTagsOf(
      cardId,
      selectedIds.includes(tagId) ? selectedIds.filter((id) => id !== tagId) : [...selectedIds, tagId],
    );
  };

  const createAndAdd = () => {
    const name = query.trim();
    if (!name) return;
    const tag = ensureTag(name);
    setCardTagsOf(cardId, [...selectedIds, tag.id]);
    setQuery('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {selected.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]"
          style={{ boxShadow: `inset 2px 0 0 ${t.color}` }}
        >
          <Dot color={t.color} className="size-1.5" />
          {t.name}
          <button className="text-muted-foreground hover:text-destructive" onClick={() => toggle(t.id)}>
            <X className="size-2.5" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 gap-1 px-1.5 text-[11px]">
            <TagIcon className="size-3" />
            标签
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (available.length > 0 && !query.trim()) return;
                // 有精确同名标签就切换，否则创建
                const exact = tags.find((t) => t.name === query.trim());
                if (exact) toggle(exact.id);
                else createAndAdd();
              }
            }}
            placeholder="搜索或输入新标签后回车"
            className="h-7 text-xs"
          />
          <div className="mt-1.5 max-h-52 overflow-y-auto">
            {available.map((t) => (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
              >
                <Dot color={t.color} />
                <span className="flex-1 truncate">{t.name}</span>
              </button>
            ))}
            {query.trim() && !tags.some((t) => t.name === query.trim()) && (
              <button
                onClick={createAndAdd}
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-primary hover:bg-accent"
              >
                <Plus className="size-3" /> 新建标签「{query.trim()}」
              </button>
            )}
            {available.length === 0 && !query.trim() && (
              <div className="px-1.5 py-2 text-[11px] text-muted-foreground">还没有标签，直接输入即可创建</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** 标签复选列表（用于批量打标签或筛选面板） */
export function TagCheckList({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const tags = useStore((s) => s.tags);
  if (tags.length === 0) {
    return <div className="px-2 py-3 text-[11px] text-muted-foreground">暂无标签</div>;
  }
  return (
    <div className={cn('space-y-0.5', className)}>
      {tags.map((t) => {
        const active = value.includes(t.id);
        return (
          <button
            key={t.id}
            onClick={() => onChange(active ? value.filter((id) => id !== t.id) : [...value, t.id])}
            className={cn(
              'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors',
              active ? 'bg-primary/15 text-primary' : 'hover:bg-accent',
            )}
          >
            <span
              className={cn(
                'flex size-3 items-center justify-center rounded-sm border',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
              )}
            >
              {active && <Check className="size-2.5" />}
            </span>
            <Dot color={t.color} />
            <span className="flex-1 truncate">{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 只读标签展示 */
export function TagChips({ tagIds, className }: { tagIds: string[]; className?: string }) {
  const tags = useStore((s) => s.tags);
  const owned = tags.filter((t) => tagIds.includes(t.id));
  if (owned.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {owned.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
          <Dot color={t.color} className="size-1.5" />
          {t.name}
        </span>
      ))}
    </div>
  );
}
