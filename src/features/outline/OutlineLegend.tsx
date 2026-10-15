/**
 * 状态图例浮层
 * ------------------------------------------------------------------
 * 不占页签、也不占侧栏（侧栏那一节已删）：树形 / 思维导图的右上角
 * 浮一个 size-7 小按钮，点开才展开四块底色说明。
 */
import { Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { OUTLINE_STATUS } from '@/types';
import { OutlineStatusChip } from './OutlineStatusChip';
import { statusStyle } from './outlineStatus';

export function OutlineLegend({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="状态图例"
          className={cn(
            'inline-flex size-7 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground',
            className,
          )}
        >
          <Palette className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="mb-1.5 text-[10px] text-muted-foreground">点节点左侧的小色点可循环切换状态</div>
        <div className="space-y-1">
          {OUTLINE_STATUS.map((s) => (
            <div key={s.status} className="flex items-center gap-1.5">
              <span className={cn('size-2.5 shrink-0 rounded-sm', statusStyle(s.status).dot)} />
              <OutlineStatusChip status={s.status} className="text-xs">
                {s.label}
              </OutlineStatusChip>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
