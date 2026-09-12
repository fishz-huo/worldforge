/**
 * 面板外壳
 * ------------------------------------------------------------------
 * SidePanel（次级侧栏）与 InspectorPanel（右侧检查器）共用一套外壳：
 *  - 受 store 的 sidebarOpen / inspectorOpen 控制，关闭时整块不渲染；
 *  - 桌面端是并排栏，移动端自动变成浮层（fixed），保证手机上可用。
 */
import type { ReactNode } from 'react';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

interface PanelProps {
  title: ReactNode;
  /** 标题右侧的操作按钮 */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 次级侧栏（左） */
export function SidePanel({ title, actions, children, className }: PanelProps) {
  const open = useStore((s) => s.sidebarOpen);
  const setOpen = useStore((s) => s.setSidebarOpen);
  const focusMode = useStore((s) => s.focusMode);
  if (!open || focusMode) return null;

  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col border-r border-border bg-card/40',
        // 移动端：抽屉式浮层
        'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:w-72 max-md:bg-card max-md:shadow-xl',
        className,
      )}
    >
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <div className="truncate text-xs font-semibold">{title}</div>
        <div className="flex items-center gap-0.5">
          {actions}
          <Hint label="收起侧栏 (Ctrl+B)">
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} className="max-md:hidden">
              <PanelLeftClose />
            </Button>
          </Hint>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

/** 右侧检查器 */
export function InspectorPanel({ title, actions, children, className }: PanelProps) {
  const open = useStore((s) => s.inspectorOpen);
  const setOpen = useStore((s) => s.setInspectorOpen);
  const focusMode = useStore((s) => s.focusMode);
  if (!open || focusMode) return null;

  return (
    <aside
      className={cn(
        'flex w-80 shrink-0 flex-col border-l border-border bg-card/40',
        'max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:w-80 max-lg:bg-card max-lg:shadow-xl',
        className,
      )}
    >
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <div className="truncate text-xs font-semibold">{title}</div>
        <div className="flex items-center gap-0.5">
          {actions}
          <Hint label="收起检查器 (Ctrl+I)">
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
              <PanelRightClose />
            </Button>
          </Hint>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

/** 模块内容区通用容器：负责三栏布局与滚动 */
export function ModuleLayout({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 w-full">{children}</div>;
}

/** 主内容区（自动占满剩余宽度） */
export function ModuleBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', className)}>{children}</div>;
}
