/**
 * 左侧图标导航栏
 * ------------------------------------------------------------------
 * 需求 6：界面简约、可隐藏、随时调出。
 * 桌面端是竖直图标栏（9 个模块 + 世界切换）；移动端换成底部标签栏
 * （见 MobileNav：只留 4 个高频模块 + 「更多」，9 个塞进 360px 会重叠）。
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { MobileNav } from './MobileNav';
import { MODULES } from './modules';
import { WorldSwitcher } from './WorldSwitcher';

export function SideRail() {
  const module = useStore((s) => s.module);
  const setModule = useStore((s) => s.setModule);
  const railOpen = useStore((s) => s.railOpen);
  const setRailOpen = useStore((s) => s.setRailOpen);
  const focusMode = useStore((s) => s.focusMode);

  // 专注模式：桌面只留底部导航（手机上仍可切模块），保持"沉浸"的语义
  if (focusMode) return <MobileNav />;

  if (!railOpen) {
    return (
      <>
        <div className="hidden w-9 shrink-0 flex-col items-center border-r border-border bg-card/40 py-1 md:flex">
          <Hint label="展开导航栏" side="right">
            <button
              onClick={() => setRailOpen(true)}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </Hint>
        </div>
        <MobileNav />
      </>
    );
  }

  return (
    <>
      <aside className="hidden w-14 shrink-0 flex-col justify-between border-r border-border bg-card/40 md:flex">
        <div className="flex flex-col items-center gap-0.5 py-1">
          {MODULES.map((m, i) => (
            <Hint key={m.key} label={`${m.label} · ${m.hint}（${i + 1}）`} side="right">
              <button
                onClick={() => setModule(m.key)}
                className={cn(
                  'relative flex size-10 flex-col items-center justify-center rounded-md transition-colors',
                  module === m.key
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon name={m.icon} className="size-4" />
                <span className="mt-0.5 text-[10px] leading-none">{m.label}</span>
                {module === m.key && (
                  <span className="absolute -left-1.5 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
              </button>
            </Hint>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1 pb-1">
          <Hint label="收起导航栏" side="right">
            <button
              onClick={() => setRailOpen(false)}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
          </Hint>
          <WorldSwitcher compact />
        </div>
      </aside>
      <MobileNav />
    </>
  );
}
