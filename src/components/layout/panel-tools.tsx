/**
 * 面板相关的两个小工具
 * ------------------------------------------------------------------
 * 从 SidePanel.tsx 拆出来（那个文件加上注释会顶到 200 行上限）：
 *   - useExclusiveDrawer：窄屏下两个抽屉互斥
 *   - ResizeHandle：可拖拽的分隔条
 * 两个都只被侧栏/检查器用，放在一起比塞回主文件更好读。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { INSPECTOR_LIMITS, SIDEBAR_LIMITS } from '@/lib/layout-sync';
import { useStore } from '@/store';

/**
 * 抽屉互斥：两个侧栏在窄屏下都是 fixed 浮层，同时打开会叠在一起，
 * 后打开的整个盖住先打开的（用户会以为"刚才那个不见了"甚至以为数据丢了）。
 * 所以谁被打开就关掉另一个 —— 同一时刻最多一个浮层。
 * 只在窄屏生效：桌面端左右两栏并排本来就是正常的。
 */
export function useExclusiveDrawer(self: 'sidebar' | 'inspector', open: boolean) {
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setInspectorOpen = useStore((s) => s.setInspectorOpen);
  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1023px)').matches) return;
    if (self === 'sidebar') setInspectorOpen(false);
    else setSidebarOpen(false);
  }, [open, self, setSidebarOpen, setInspectorOpen]);
}

/**
 * 分隔条。
 *
 * 宽度改在指针移动时**直接写 DOM 变量**，而不是先进 store：
 * React 状态更新要等一次重渲染，拖拽时手感会比鼠标慢半拍；
 * 写变量是同步的，界面当场跟着走。松手时才提交一次给 store（落盘由 store 侧去抖）。
 * 过程中同步更新一个本地 state，是为了让提示气泡里的数字跟着变。
 * 双击复位是所有编辑器（VS Code、DevTools）的通用习惯，顺手做上。
 */
export function ResizeHandle({ side }: { side: 'left' | 'right' }) {
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
