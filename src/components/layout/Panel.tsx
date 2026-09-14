/**
 * 面板外壳
 * ------------------------------------------------------------------
 * SidePanel（次级侧栏）与 InspectorPanel（右侧检查器）共用一套外壳：
 *  - 受 store 的 sidebarOpen / inspectorOpen 控制，关闭时整块不渲染；
 *  - 桌面端是并排栏，移动端自动变成浮层（fixed），保证手机上可用；
 *  - 宽度由 CSS 变量给出（见 lib/layout-sync.ts），分隔条可拖拽调整。
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { INSPECTOR_LIMITS, SIDEBAR_LIMITS } from '@/lib/layout-sync';
import { useStore } from '@/store';

/** 面板外壳的公共结构：标题栏 + 可滚动内容区 */
interface PanelProps {
  title: ReactNode;
  /** 标题右侧的操作按钮 */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 分隔条。
 *
 * 宽度改在指针移动时**直接写 DOM 变量**，而不是先进 store：
 * React 状态更新要等一次重渲染，拖拽时手感会比鼠标慢半拍；
 * 写变量是同步的，界面当场跟着走。松手时才提交一次给 store（落盘由 store 侧去抖）。
 * 过程中同步更新一个本地 state，是为了让提示气泡里的数字跟着变。
 *
 * 双击复位是所有编辑器（VS Code、DevTools）的通用习惯，顺手做上。
 */
function ResizeHandle({ side }: { side: 'left' | 'right' }) {
  const setWidth = useStore((s) => (side === 'left' ? s.setSidebarWidth : s.setInspectorWidth));
  const resetWidths = useStore((s) => s.resetPanelWidths);
  const [dragging, setDragging] = useState(false);
  const [hintRem, setHintRem] = useState(0);
  const draggingRef = useRef(false);

  const limits = side === 'left' ? SIDEBAR_LIMITS : INSPECTOR_LIMITS;
  const cssVar = side === 'left' ? '--wf-sidebar-w' : '--wf-inspector-w';

  /** 指针在屏幕上的位置 → 这一侧的宽度（rem） */
  const widthFromPointer = useCallback(
    (clientX: number) => {
      const raw = side === 'left' ? clientX : window.innerWidth - clientX;
      const rem = raw / 16;
      return Math.min(limits.max, Math.max(limits.min, Math.round(rem * 100) / 100));
    },
    [side, limits.min, limits.max],
  );

  const preview = useCallback(
    (rem: number) => {
      document.documentElement.style.setProperty(cssVar, `${rem}rem`);
      setHintRem(rem);
    },
    [cssVar],
  );

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={side === 'left' ? '调整侧栏宽度' : '调整检查器宽度'}
        title="拖动调整宽度 · 双击复位"
        onPointerDown={(e) => {
          // 捕获指针：拖到面板外面（甚至窗口边缘）也能继续收到事件
          e.currentTarget.setPointerCapture(e.pointerId);
          draggingRef.current = true;
          setDragging(true);
          setHintRem(widthFromPointer(e.clientX));
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          preview(widthFromPointer(e.clientX));
        }}
        onPointerUp={(e) => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          setDragging(false);
          setWidth(widthFromPointer(e.clientX));
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          setDragging(false);
        }}
        onDoubleClick={() => resetWidths()}
        className={cn(
          'relative z-20 w-1 shrink-0 cursor-col-resize bg-transparent transition-colors',
          'hover:bg-primary/40',
          dragging && 'bg-primary/60',
          // 手机上两栏都是浮层，没有「并排」这回事，分隔条必须收起来
          'max-md:hidden',
          side === 'right' && 'max-lg:hidden',
        )}
      />
      {dragging && (
        <div className="pointer-events-none fixed inset-y-0 left-1/2 z-50 -translate-x-1/2 rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md">
          {Math.round(hintRem * 16)} px
        </div>
      )}
    </>
  );
}

/** 次级侧栏（左） */
export function SidePanel({ title, actions, children, className }: PanelProps) {
  const open = useStore((s) => s.sidebarOpen);
  const setOpen = useStore((s) => s.setSidebarOpen);
  const focusMode = useStore((s) => s.focusMode);
  if (!open || focusMode) return null;

  return (
    <>
      <aside
        style={{ width: 'var(--wf-sidebar-w)' }}
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-card/40',
          // 移动端：抽屉式浮层（宽度由 max-md:w-72 覆盖，不吃桌面端的变量）
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
      <ResizeHandle side="left" />
    </>
  );
}

/** 右侧检查器 */
export function InspectorPanel({ title, actions, children, className }: PanelProps) {
  const open = useStore((s) => s.inspectorOpen);
  const setOpen = useStore((s) => s.setInspectorOpen);
  const focusMode = useStore((s) => s.focusMode);
  if (!open || focusMode) return null;

  return (
    <>
      <ResizeHandle side="right" />
      <aside
        style={{ width: 'var(--wf-inspector-w)' }}
        className={cn(
          'flex shrink-0 flex-col border-l border-border bg-card/40',
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
    </>
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
