/**
 * 卡片库侧栏
 * ------------------------------------------------------------------
 * 筛选与导航：类型、标签、置顶。
 * 需求 11：通过 tag 筛选卡片；tag 内容自由填写（在 TagPicker 里）。
 */
import { useMemo } from 'react';
import { Filter, Plus, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SectionTitle } from '@/components/ui/primitives';
import { Icon } from '@/components/Icon';
import { SidePanel } from '@/components/layout/Panel';
import { listCardTypes } from '@/lib/plugin/registry';
import { usePluginRegistry } from '@/hooks/usePluginRegistry';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { TagCheckList } from './TagPicker';

/** 新建卡片按钮（含插件注册的自定义类型） */
export function NewCardButton({ size = 'sm' }: { size?: 'sm' | 'default' }) {
  const createCard = useStore((s) => s.createCard);
  const selectCard = useStore((s) => s.selectCard);
  const setModule = useStore((s) => s.setModule);
  usePluginRegistry(); // 订阅：插件注册新类型后菜单要立即更新

  const types = listCardTypes();
  const builtin = types.filter((t) => !t.fromPlugin);
  const custom = types.filter((t) => t.fromPlugin);

  const create = (type: string) => {
    const card = createCard(type, { title: '未命名' });
    setModule('cards');
    selectCard(card.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} className="gap-1">
          <Plus className="size-3.5" /> 新建卡片
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>内置类型</DropdownMenuLabel>
        {builtin.map((t) => (
          <DropdownMenuItem key={t.type} onSelect={() => create(t.type)}>
            <Icon name={t.icon} style={{ color: t.color }} />
            {t.label}
          </DropdownMenuItem>
        ))}
        {custom.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>插件扩展类型</DropdownMenuLabel>
            {custom.map((t) => (
              <DropdownMenuItem key={t.type} onSelect={() => create(t.type)}>
                <Icon name={t.icon} style={{ color: t.color }} />
                {t.label}
                <span className="ml-auto text-[10px] text-muted-foreground">{t.pluginName}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CardsSidebar() {
  const cards = useStore((s) => s.cards);
  const selectedType = useStore((s) => s.selectedCardType);
  const setCardType = useStore((s) => s.setCardType);
  const selectedTagIds = useStore((s) => s.selectedTagIds);
  const setTagFilter = useStore((s) => s.setTagFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const branchScope = useStore((s) => s.branchScope);
  const branchId = useStore((s) => s.currentBranchId);
  const pinnedOnly = useStore((s) => s.pinnedOnly);
  const setPinnedOnly = useStore((s) => s.setPinnedOnly);
  usePluginRegistry();

  /** 各类型数量（考虑分支可见性） */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    cards
      .filter((c) => branchScope === 'all' || c.branch_id === null || c.branch_id === branchId)
      .forEach((c) => map.set(c.type, (map.get(c.type) ?? 0) + 1));
    return map;
  }, [cards, branchScope, branchId]);

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const hasFilter = selectedType !== null || selectedTagIds.length > 0 || pinnedOnly;

  return (
    <SidePanel
      title="卡片库"
      actions={
        <Button
          variant="ghost"
          size="icon-sm"
          title="清除筛选"
          className={cn(!hasFilter && 'opacity-40')}
          onClick={() => {
            clearFilters();
          }}
        >
          <X />
        </Button>
      }
    >
      <div className="space-y-1 p-2">
        <NewCardButton />

        <button
          onClick={() => {
            setCardType(null);
            setPinnedOnly(false);
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
            !selectedType && !pinnedOnly ? 'bg-primary/15 text-primary' : 'hover:bg-accent',
          )}
        >
          <Icon name="Boxes" className="size-3.5" />
          <span className="flex-1">全部卡片</span>
          <span className="text-[10px] text-muted-foreground">{total}</span>
        </button>

        <button
          onClick={() => setPinnedOnly(!pinnedOnly)}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
            pinnedOnly ? 'bg-amber-500/15 text-amber-400' : 'hover:bg-accent',
          )}
        >
          <Star className="size-3.5" />
          <span className="flex-1">仅置顶</span>
          <span className="text-[10px] text-muted-foreground">{cards.filter((c) => c.pinned === 1).length}</span>
        </button>

        <SectionTitle>按类型</SectionTitle>
        <div className="space-y-0.5">
          {listCardTypes().map((t) => {
            const count = counts.get(t.type) ?? 0;
            if (count === 0 && selectedType !== t.type) return null;
            return (
              <button
                key={t.type}
                onClick={() => setCardType(selectedType === t.type ? null : t.type)}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                  selectedType === t.type ? 'bg-primary/15 text-primary' : 'hover:bg-accent',
                )}
              >
                <Icon name={t.icon} className="size-3.5" style={{ color: t.color }} />
                <span className="flex-1 truncate">{t.label}</span>
                <span className="text-[10px] text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>

        <SectionTitle
          right={
            selectedTagIds.length > 0 ? (
              <button className="text-[10px] text-primary hover:underline" onClick={() => setTagFilter([])}>
                清除
              </button>
            ) : (
              <Filter className="size-3 text-muted-foreground" />
            )
          }
        >
          按标签{selectedTagIds.length > 0 ? `（${selectedTagIds.length}）` : ''}
        </SectionTitle>
        <TagCheckList value={selectedTagIds} onChange={setTagFilter} />
      </div>
    </SidePanel>
  );
}
