/**
 * 界面布局同步（store → CSS 变量 → DOM）
 * ------------------------------------------------------------------
 * 需求 6「界面简约易看」的延伸：左右两栏宽度可调、整界面可缩放。
 *
 * 为什么走 CSS 变量而不是给每个组件传 prop：
 *   面板宽度与缩放是**全局**属性，而且要在 store 之外的普通 CSS 里也能用
 *   （例如拖拽手柄的宽度、媒体查询的兜底值）。写进 :root 的自定义属性是最短的路径，
 *   组件只管读变量，不需要层层透传。
 *
 * 为什么订阅 store 而不是在组件里 useEffect：
 *   缩放必须在**首次绘制之前**就生效，否则用户会看到界面先以 100% 闪一下再跳到设定值。
 *   main.tsx 在挂载 React 之后立刻调用 watchLayout()，两者同一次同步执行，没有中间帧。
 */
import { savePrefs, WIDTH_LIMITS } from '@/store/prefs';
import { useStore } from '@/store';

/**
 * 面板宽度用 CSS 变量表达，单位为 rem（=16px）。
 * 上下限定义在 store/prefs.ts（那里也要用它做落盘校验），这里只做转发，
 * 免得出现两套极限值互相打架。
 */
export const SIDEBAR_LIMITS = WIDTH_LIMITS.sidebar;
export const INSPECTOR_LIMITS = WIDTH_LIMITS.inspector;

/** 把数值钳制到区间内（拖拽过程也会调用，所以必须是纯函数） */
export function clampWidth(value: number, limit: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return limit.min;
  return Math.min(limit.max, Math.max(limit.min, Math.round(value * 100) / 100));
}

/**
 * 写入界面缩放。
 *
 * 缩放方式的选择：优先用标准 `zoom`。
 *   - 它是**布局级**缩放：滚动条、命中测试、`position: fixed` 都会一起缩放，
 *     而 `transform: scale()` 只是视觉变换，会出现「点得到但看着不在那」的错位。
 *   - Chromium（桌面 WebView2、Android WebView）与较新的 Safari 都支持；
 *     万一将来遇到不支持的引擎，兜底是放大根节点尺寸并让外层 `overflow: auto` 滚动，
 *     界面不会崩，只是要滚动才能看全。
 */
export function applyUiScale(scale: number): void {
  const root = document.documentElement;
  const value = Number.isFinite(scale) && scale > 0 ? scale : 1;
  root.style.setProperty('--wf-ui-scale', String(value));
  const zoomable = 'zoom' in root.style;
  if (zoomable) {
    root.style.removeProperty('width');
    root.style.zoom = String(value);
    return;
  }
  // 兜底：放大画布再滚动，避免内容被裁掉
  root.style.zoom = '';
  root.style.width = `${100 / value}%`;
}

/**
 * 写入左右两栏宽度。
 *
 * 为什么要写两个变量（`-w` 与 `-w-drawer`）：
 *   面板的宽度写在**内联 style** 里（`width: var(--wf-sidebar-w)`），而内联
 *   style 的优先级高于任何 class —— 于是 Tailwind 的 `max-lg:w-[...]`
 *   根本压不住它。窄屏抽屉因此永远是设定宽度（360px 的屏幕上它比屏幕还宽，
 *   跑到屏幕外，看起来就是"排版坏了"）。
 *   正确做法是把"窄屏要留出边缘"这件事放进变量本身：内联 style 不变，
 *   窄屏时变量自动变成 min(设定宽度, 视口 − 4rem)。
 *   留 4rem 是为了让用户还能看到并点到外面那层（点一下就关掉抽屉）。
 */
export function applyPanelWidths(sidebar: number, inspector: number): void {
  const root = document.documentElement;
  const side = clampWidth(sidebar, SIDEBAR_LIMITS);
  const insp = clampWidth(inspector, INSPECTOR_LIMITS);
  root.style.setProperty('--wf-sidebar-w', `${side}rem`);
  root.style.setProperty('--wf-inspector-w', `${insp}rem`);
  root.style.setProperty('--wf-sidebar-w-drawer', `min(${side}rem, 100vw - 4rem)`);
  root.style.setProperty('--wf-inspector-w-drawer', `min(${insp}rem, 100vw - 4rem)`);
}

/** 参数变了要落盘，但拖拽时一秒能触发几十次，去抖再写 localStorage */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveWidthsSoon(sidebar: number, inspector: number): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    savePrefs({ sidebarWidth: sidebar, inspectorWidth: inspector });
  }, 250);
}

/**
 * 订阅布局状态并同步到 DOM。
 * 注册时立即执行一次 —— 这就是「首帧不闪」的保证。
 */
export function watchLayout(): void {
  const push = (state: { uiScale: number; sidebarWidth: number; inspectorWidth: number }) => {
    applyUiScale(state.uiScale);
    applyPanelWidths(state.sidebarWidth, state.inspectorWidth);
  };
  // 注册时立即跑一次：这一步保证首帧就是用户设定的缩放与宽度
  push(useStore.getState());

  let prevSidebar = useStore.getState().sidebarWidth;
  let prevInspector = useStore.getState().inspectorWidth;

  useStore.subscribe((state) => {
    push(state);
    // 只有宽度变化才值得写盘（拖拽高频触发），缩放是低频操作，由设置面板自己存
    if (state.sidebarWidth !== prevSidebar || state.inspectorWidth !== prevInspector) {
      prevSidebar = state.sidebarWidth;
      prevInspector = state.inspectorWidth;
      saveWidthsSoon(state.sidebarWidth, state.inspectorWidth);
    }
  });
}
