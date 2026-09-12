/**
 * 卡片网格
 * ------------------------------------------------------------------
 * 卡片库的主视图：工具栏（结果统计 / 排序 / 每行数量）+ 自适应网格。
 */
import { useMemo, useState } from 'react';
import { ArrowDownUp, Boxes, LayoutGrid, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { filterCards } from '@/lib/query';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { CardTile } from './CardTile';
import { NewCardButton } from './CardsSidebar';

type SortKey = 'updated' | 'created' | 'title' | 'type';

export function CardsGrid() {
  const cards = useStore((s) => s.cards);
  const cardTags = useStore((s) => s.cardTags);
  const selectedType = useStore((s) => s.selectedCardType);
  const selectedTagIds = useStore((s) => s.selectedTagIds);
  const search = useStore((s) => s.search);
  const branchScope = useStore((s) => s.branchScope);
  const branchId = useStore((s) => s.currentBranchId);
  const pinnedOnly = useStore((s) => s.pinnedOnly);
  const columns = useStore((s) => s.cardColumns);
  const setColumns = useStore((s) => s.setCardColumns);
  const [sort, setSort] = useState<SortKey>('updated');

  const list = useMemo(() => {
    const filtered = filterCards(cards, cardTags, {
      type: selectedType,
      tagIds: selectedTagIds,
      search,
      branchId,
      branchScope,
      pinnedOnly,
    });
    const sorted = [...filtered];
    if (sort === 'updated') sorted.sort((a, b) => b.updated_at - a.updated_at);
    if (sort === 'created') sorted.sort((a, b) => b.created_at - a.created_at);
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    if (sort === 'type') sorted.sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title, 'zh-CN'));
    // 置顶永远在前
    return sorted.sort((a, b) => b.pinned - a.pinned);
  }, [cards, cardTags, selectedType, selectedTagIds, search, branchId, branchScope, pinnedOnly, sort]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          共 <span className="font-medium text-foreground">{list.length}</span> 张卡片
          {selectedType && ` · 类型筛选`}
          {selectedTagIds.length > 0 && ` · ${selectedTagIds.length} 个标签`}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <ArrowDownUp className="mr-1 size-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">最近修改</SelectItem>
              <SelectItem value="created">创建时间</SelectItem>
              <SelectItem value="title">标题</SelectItem>
              <SelectItem value="type">类型</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden items-center gap-0.5 rounded-md border border-border p-0.5 sm:flex">
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                onClick={() => setColumns(n)}
                title={`每行 ${n} 张`}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px]',
                  columns === n ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <LayoutGrid className="size-3" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {list.length === 0 ? (
          <EmptyState
            icon={<Boxes />}
            title={search ? '没有匹配的卡片' : '这里还没有卡片'}
            description={
              search
                ? '试试更换关键词，或清除标签筛选。'
                : '卡片是世界观的最小知识单元：角色、地点、事件、底层逻辑、参考资料都可以是卡片。'
            }
            action={<div className="mt-2"><NewCardButton /></div>}
          />
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${columns === 2 ? 320 : columns === 3 ? 240 : 190}px, 1fr))` }}
          >
            {list.map((c) => (
              <CardTile key={c.id} cardId={c.id} />
            ))}
            <button
              onClick={() => useStore.getState().createCard(selectedType ?? 'note', { title: '未命名' })}
              className="flex min-h-[110px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="size-4" />
              快速新建
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
