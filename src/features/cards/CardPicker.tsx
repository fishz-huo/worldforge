/**
 * 卡片选择器
 * ------------------------------------------------------------------
 * 关联、大纲节点、时间轴条目、地图标记都需要「挑一张卡片」，
 * 统一用这个对话框，避免各处重复实现搜索与列表逻辑。
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { EmptyState } from '@/components/ui/primitives';
import { cn, matches } from '@/lib/utils';
import { useStore } from '@/store';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (cardId: string) => void;
  /** 限定可选类型 */
  types?: string[];
  /** 需要排除的卡片（例如自己） */
  excludeIds?: string[];
  title?: string;
}

export function CardPicker({ open, onOpenChange, onSelect, types, excludeIds = [], title = '选择卡片' }: Props) {
  const cards = useStore((s) => s.cards);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    return cards
      .filter((c) => !excludeIds.includes(c.id))
      .filter((c) => (types && types.length > 0 ? types.includes(c.type) : true))
      .filter((c) => matches(query, c.title, c.subtitle, c.summary))
      .slice(0, 200);
  }, [cards, types, excludeIds, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-2 p-2" hideClose>
        <DialogTitle className="px-1 pt-1 text-xs font-semibold">{title}</DialogTitle>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索卡片标题 / 摘要"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {list.length === 0 ? (
            <EmptyState title="没有匹配的卡片" description="换个关键词，或先到卡片 Wiki 里新建一张。" />
          ) : (
            list.map((c) => {
              const def = getCardType(c.type);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c.id);
                    onOpenChange(false);
                  }}
                  className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent')}
                >
                  <Icon name={def.icon} className="size-3.5 shrink-0" style={{ color: def.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.title}</span>
                    {c.subtitle && <span className="block truncate text-[10px] text-muted-foreground">{c.subtitle}</span>}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{def.label}</span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
