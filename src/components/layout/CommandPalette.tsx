/**
 * 命令面板（Ctrl/Cmd+K）
 * ------------------------------------------------------------------
 * 需求 6：操作要方便。所有功能都能在这里两步内触达。
 * 条目来源见 commandItems.ts（导航 / 动作 / 插件命令 / 卡片 / 文稿）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/Icon';
import { cn, matches } from '@/lib/utils';
import { useStore } from '@/store';
import { useCommandItems } from './commandItems';

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const items = useCommandItems();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => items.filter((item) => matches(query, item.title, item.hint, item.group)).slice(0, 60),
    [items, query],
  );

  useEffect(() => setCursor(0), [query, open]);
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  /** 键盘导航：↑↓ 选择，Enter 执行 */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[cursor]?.run();
      setOpen(false);
    }
  };

  // 保证选中项始终可见
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let lastGroup = '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-2 p-2" hideClose>
        <DialogTitle className="sr-only">命令面板</DialogTitle>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索命令、卡片、文稿…"
            className="h-9 border-0 pl-7 shadow-none focus-visible:ring-0"
          />
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">没有匹配项</div>
          )}
          {filtered.map((item, i) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const Ico = item.icon;
            return (
              <div key={item.id}>
                {showGroup && (
                  <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.group}
                  </div>
                )}
                <button
                  data-active={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    item.run();
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs',
                    i === cursor ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                  )}
                >
                  {Ico ? (
                    <Ico className="size-3.5 shrink-0" />
                  ) : (
                    <Icon name={item.iconName ?? 'Boxes'} className="size-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.hint && (
                    <span className="max-w-[45%] truncate text-[10px] text-muted-foreground">{item.hint}</span>
                  )}
                  {i === cursor && <CornerDownLeft className="size-3 shrink-0 text-muted-foreground" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-2 pt-1.5 text-[10px] text-muted-foreground">
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
