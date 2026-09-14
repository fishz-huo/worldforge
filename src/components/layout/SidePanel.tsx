/**
 * 侧栏与检查器（左右两个抽屉面板）
 * ==================================================================
 * 移动端的四条规则都落在这里：
 *   1. 窄屏下两栏都是 fixed 浮层（不挤压内容区）；
 *   2. 浮层底部空出标签栏高度（--wf-bottom-nav），最后一行才点得到；
 *   3. 两个浮层互斥：同时打开会互相盖住，用户会以为数据丢了；
 *   4. 拖拽分隔条在窄屏隐藏（浮层没有"并排"这回事）。
 * 互斥与分隔条在 panel-tools.tsx（这个文件加上注释会顶到 200 行）。
 */
import type { ReactNode } from 'react';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { ResizeHandle, useExclusiveDrawer } from './panel-tools';

/** 面板外壳的公共结构：标题栏 + 可滚动内容区 */
export interface PanelProps {
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
  useExclusiveDrawer('sidebar', open && !focusMode);
  if (!open || focusMode) return null;

  return (
    <>
      <aside
        style={{ width: 'var(--wf-sidebar-w)' }}
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-card/40',
          // 移动端：抽屉浮层，底部空出标签栏高度，宽度由 max-md:w-72 覆盖
          'max-md:fixed max-md:left-0 max-md:top-0 max-md:z-30 max-md:w-72 max-md:bg-card max-md:shadow-xl',
          'max-md:bottom-[var(--wf-bottom-nav)]',
          className,
        )}
      >
        <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
          <div className="truncate text-xs font-semibold">{title}</div>
          <div className="flex items-center gap-0.5">
            {actions}
            {/* 桌面：附快捷键提示；手机：同一个按钮，但快捷键用不上 */}
            <Hint label="收起侧栏 (Ctrl+B)">
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} className="max-md:hidden">
                <PanelLeftClose />
              </Button>
            </Hint>
            <Button
              variant="ghost"
              size="icon-sm"
              title="收起侧栏"
              onClick={() => setOpen(false)}
              className="md:hidden"
            >
              <PanelLeftClose />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
      <ResizeHandle side="left" />
    </>
  );
}

/** 右侧检查器 */
export function InspectorPanel({ title, actions, children, className }: PanelProps) {
  const open = useStore((s) => s.inspectorOpen);
  const setOpen = useStore((s) => s.setInspectorOpen);
  const focusMode = useStore((s) => s.focusMode);
  useExclusiveDrawer('inspector', open && !focusMode);
  if (!open || focusMode) return null;

  return (
    <>
      <ResizeHandle side="right" />
      <aside
        style={{ width: 'var(--wf-inspector-w)' }}
        className={cn(
          'flex shrink-0 flex-col border-l border-border bg-card/40',
          // 窄屏：抽屉浮层，同样空出底部标签栏的高度
          'max-lg:fixed max-lg:right-0 max-lg:top-0 max-lg:z-30 max-lg:w-80 max-lg:bg-card max-lg:shadow-xl',
          'max-lg:bottom-[var(--wf-bottom-nav)]',
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
    </>
  );
}
