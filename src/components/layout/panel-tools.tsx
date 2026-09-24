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
import { clampWidth, INSPECTOR_LIMITS, SIDEBAR_LIMITS } from '@/lib/layout-sync';
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
 * 「三栏别挤在一起」的宽度阈值。
 *
 * 两栏并排时的固定开销：图标栏 56 + 侧栏 256 + 检查器 320 + 两条分隔条 16
 * = 648px。窗口宽 1024 时主内容区只剩 376px —— 地图画布、时间轴、分栏写作
 * 都是横向内容，376px 下虽然"都点得到"，但已经没法用了；1080p 缩放后
 * 常见的 1250~1280px 逻辑宽度也落在"该收一栏"的区间里。
 * 所以跨过这个宽度就往回收：收起来的栏随时能从顶栏两个按钮 / Ctrl+B / Ctrl+I 调出来。
 */
export const DRAWER_COLLAPSE_WIDTH = 1280;

/**
 * 进入窄屏时自动收起左右两栏。
 *
 * 为什么需要：1280px 以上的窗口里侧栏/检查器是**并排**的两个正常栏，
 * 用户不会特意去关它们；一旦把窗口拖窄（或手机横竖屏切换、或 1080p 开了
 * 125% 缩放），同一个 `sidebarOpen` 就变成"两个浮层同时盖在内容上"，
 * 或者"三栏把主内容压到 400px"—— 用户看到的是左边一层卡片列表、右边一层
 * 检查器、底下还有内容，像排版坏了。
 * 这里在跨过断点的那一刻把两栏都收起来，让用户自己决定要哪个；
 * 只在**跨越断点**时触发，所以之后手动打开的面板不会被立刻关掉。
 *
 * 补一条启动时的例外：打开就是窄窗口（缩放后的 1080p 很常见）时不会有
 * "跨越断点"这个动作，于是三栏会一直挤着。这时收掉检查器、留下侧栏
 * —— 侧栏是导航主力，检查器按需再开。
 */
export function useAutoCollapseDrawers(): void {
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setInspectorOpen = useStore((s) => s.setInspectorOpen);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${DRAWER_COLLAPSE_WIDTH - 1}px)`);
    if (mq.matches) {
      const s = useStore.getState();
      // 只在"窗口宽到两栏是并排的"区间里做这件事：再窄下去两栏本来就是浮层，
      // 浮层不占内容区宽度，交给 useExclusiveDrawer 管。
      if (window.innerWidth >= 1024 && s.sidebarOpen && s.inspectorOpen && !s.focusMode) setInspectorOpen(false);
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) return;
      setSidebarOpen(false);
      setInspectorOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [setSidebarOpen, setInspectorOpen]);
}

/**
 * 分隔条。
 *
 * 宽度改在指针移动时**直接写 DOM 变量**，而不是先进 store：
 * React 状态更新要等一次重渲染，拖拽时手感会比鼠标慢半拍；
 * 写变量是同步的，界面当场跟着走。松手时才提交一次给 store（落盘由 store 侧去抖）。
 *
 * 三个踩过的坑，都在这里修掉：
 *   1. 手柄只有 4px 宽、悬停才变色 —— 用户找不到它，以为中间莫名其妙
 *      多了一条缝。现在命中区 8px，中间画一条 1px 的常驻竖线（对齐用）。
 *   2. 拖动时那条"640 px"提示原来是 `inset-y-0`，等于**从屏幕顶拉到屏幕底**
 *      的一条竖直色带 —— 拖动时画面正中出现一条竖杠，用户报的就是这个。
 *      现在是一个居中的小胶囊。
 *   3. 双击复位用 React 的 onDoubleClick：它依赖浏览器判定两次点击是否算
 *      "同一位置双击"，与指针捕获（拖拽必需）叠加时并不总是触发。
 *      现在自己数 pointerdown 的次数，两次间隔够近就直接复位，不依赖 dblclick。
 */
export function ResizeHandle({ side }: { side: 'left' | 'right' }) {
  const setWidth = useStore((s) => (side === 'left' ? s.setSidebarWidth : s.setInspectorWidth));
  const resetWidths = useStore((s) => s.resetPanelWidths);
  const [dragging, setDragging] = useState(false);
  const [hintRem, setHintRem] = useState(0);
  const draggingRef = useRef(false);
  const lastDown = useRef(0);

  const limits = side === 'left' ? SIDEBAR_LIMITS : INSPECTOR_LIMITS;
  const cssVar = side === 'left' ? '--wf-sidebar-w' : '--wf-inspector-w';

  /** 指针在屏幕上的位置 → 这一侧的宽度（rem）。要扣掉界面缩放，否则放大后拖不准 */
  const widthFromPointer = useCallback(
    (clientX: number) => {
      const scale = Number(getComputedStyle(document.documentElement).zoom) || 1;
      const raw = side === 'left' ? clientX : window.innerWidth - clientX;
      return clampWidth(raw / scale / 16, limits);
    },
    [side, limits],
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
          // 双击复位：两次按下间隔够近就算，不依赖浏览器的 dblclick 判定
          const now = Date.now();
          if (now - lastDown.current < 350) {
            lastDown.current = 0;
            resetWidths();
            return;
          }
          lastDown.current = now;
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
        className={cn(
          'group relative z-20 w-2 shrink-0 cursor-col-resize',
          // 手机上两栏都是浮层，没有「并排」这回事，分隔条必须收起来
          'max-md:hidden',
          side === 'right' && 'max-lg:hidden',
        )}
      >
        {/* 常驻的细线：让"这里可以拖"看得见；悬停 / 拖动时加粗成高亮色 */}
        <span
          className={cn(
            'pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors',
            'group-hover:bg-primary/60',
            dragging && 'w-0.5 bg-primary',
          )}
        />
      </div>
      {dragging && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md ring-1 ring-border">
          {Math.round(hintRem * 16)} px
        </div>
      )}
    </>
  );
}
