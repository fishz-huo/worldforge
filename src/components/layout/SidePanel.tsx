/**
 * 侧栏与检查器（左右两个抽屉面板）
 * ==================================================================
 * 移动端的四条规则都落在这里：
 *   1. 窄屏下两栏都是 fixed 浮层（不挤压内容区）；
 *   2. 浮层底部空出标签栏高度（--wf-bottom-nav），最后一行才点得到；
 *   3. 两个浮层互斥：同时打开会互相盖住，用户会以为数据丢了；
 *   4. 拖拽分隔条在窄屏隐藏（浮层没有"并排"这回事）。
 * 互斥与分隔条在 panel-tools.tsx（这个文件加上注释会顶到 200 行）。
 *
 * v0.2.1 补第 5 条：浮层背后加一块**背板**。
 * 之前浮层直接压在内容上，用户看到的是"左半边卡片列表、右半边被切一半的
 * 卡片正文"，两层文字叠在一起像排版坏了（截图反馈就是这个问题）。
 * 背板把"这是一层浮在上面的抽屉"讲清楚，点一下就能关掉。
 */
import type { ReactNode } from 'react';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { ResizeHandle, useExclusiveDrawer } from './panel-tools';

/**
 * 面板外壳的公共结构：标题栏 + 可滚动内容区
 * （背板只在面板**打开时**渲染：它写在 if (!open) return null 之后，
 *   否则未打开的面板也会给整个应用蒙一层灰。）
 */
export interface PanelProps {
  title: ReactNode;
  /** 标题右侧的操作按钮 */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 窄屏浮层的背板。
 * 断点必须与浮层一致：检查器在 1024px 以下就是浮层，背板也得跟着，
 * 否则 768~1023px 之间浮层没有背板，看起来又像"两层排版叠在一起"。
 */
function DrawerScrim({ onClose, narrowOnly }: { onClose: () => void; narrowOnly?: boolean }) {
  return (
    <div
      onClick={onClose}
      aria-hidden
      data-wf-scrim={narrowOnly ? 'sidebar' : 'inspector'}
      className={cn(
        'fixed inset-0 z-20 bg-background/60 backdrop-blur-[1px]',
        narrowOnly ? 'max-md:block md:hidden' : 'max-lg:block lg:hidden',
      )}
    />
  );
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
      <DrawerScrim onClose={() => setOpen(false)} narrowOnly />
      <aside
        /**
         * 宽度分两档：窄屏走 drawer 变量。写在 style 上（而不是用 Tailwind 的
         * max-md:w-*）是因为内联 style 的优先级高于任何 class —— 用 class 换宽度
         * 会被这里的 style 压回去，抽屉在 360px 屏幕上比屏幕还宽。
         */
        style={{ width: 'var(--wf-panel-w)' }}
        className={cn(
          '[--wf-panel-w:var(--wf-sidebar-w)] max-md:[--wf-panel-w:var(--wf-sidebar-w-drawer)]',
          /**
           * 竖分隔线用 background 渐变画在**内部**：不占宽度。
           * 用 border-r 会多出 1px —— 面板宽度写死在变量里，
           * 1px 的差就让下面的内容区整体挪一格（第一版的白条就是这么来的）。
           */
          'flex shrink-0 flex-col bg-card/40',
          'bg-[linear-gradient(to_right,transparent_calc(100%-1px),hsl(var(--border))_calc(100%-1px))]',
          // 窄屏：抽屉浮层，底部空出标签栏高度
          'max-md:fixed max-md:left-0 max-md:top-0 max-md:z-30 max-md:bg-card max-md:shadow-xl',
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
      <DrawerScrim onClose={() => setOpen(false)} />
      <ResizeHandle side="right" />
      <aside
        // 宽度分两档，理由见 SidePanel
        style={{ width: 'var(--wf-panel-w)' }}
        className={cn(
          '[--wf-panel-w:var(--wf-inspector-w)] max-lg:[--wf-panel-w:var(--wf-inspector-w-drawer)]',
          // 分隔线同样画在内部，不占宽度（理由见 SidePanel）
          'flex shrink-0 flex-col bg-card/40',
          'bg-[linear-gradient(to_left,transparent_calc(100%-1px),hsl(var(--border))_calc(100%-1px))]',
          /**
           * 窄屏：抽屉浮层，同样空出底部标签栏的高度。
           * 宽度用 --wf-inspector-w-drawer（= min(设定宽度, 88vw)）：
           * 320px 的抽屉在 360px 的手机上会顶到屏幕左边、把内容盖得严严实实。
           */
          'max-lg:fixed max-lg:right-0 max-lg:top-0 max-lg:z-30 max-lg:bg-card max-lg:shadow-xl',
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
