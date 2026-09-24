/**
 * 视口对外的契约（MapViewportApi）
 * ==================================================================
 * 从 useMapViewport 抽出来：那个 Hook 加上这份注释会顶到「单文件 ≤200 行」。
 * 这里只放类型与"为什么长这样"的说明，实现分两处：
 *   - mapViewport.ts      纯数学（缩放/平移/适应屏幕，有自测）
 *   - useMapViewport.ts   React 接驳（量尺寸、绑事件、给世界层样式）
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

export interface MapViewportApi {
  /**
   * 绑到视口窗口（画布外层 div）上的**回调 ref**。
   * 不能用 useRef：地图模块的首帧是「还没有地图」的空状态、画布还没挂载，
   * 只在挂载时跑一次的测量 effect 会扑空 —— 窗口尺寸永远是 0×0，视口停在
   * scale=1，底图按原始像素硬塞进画布（只有浏览器里能量出来）。
   */
  boxRef: (el: HTMLDivElement | null) => void;
  /** 世界层的行内样式：宽高 = 底图像素尺寸，外加位移与缩放 */
  worldStyle: CSSProperties;
  /** 显示用的百分比（100% = 适应屏幕） */
  percent: number;
  /** 需要绑到视口窗口上的指针事件（拖拽平移） */
  bind: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
    /**
     * 只干一件事：中键按下时 preventDefault。
     * 中键在 Chrome 上是「自动滚动」圆盘，pointerdown 上拦它不一定拦得住
     * （兼容的 mousedown 才是真正触发点），所以两层都拦一遍。
     */
    onMouseDown: (e: ReactPointerEvent<HTMLElement>) => void;
  };
  /** 正在拖拽平移：光标用 grab / grabbing 区分（第三轮加入） */
  panning: boolean;
  /** 刚才这一下是拖拽还是点击（平移结束后要吃掉那次 click） */
  didDrag: () => boolean;
  /**
   * 新一次按下：清掉上一轮的拖拽标记。绑在画布的**捕获阶段** pointerdown 上
   * （图钉与浮层控件在冒泡阶段 stopPropagation，捕获阶段一定先跑）。
   * 少了它，「先平移、再点右下角缩放胶囊」的第一下会被 didDrag 守卫吃掉 ——
   * 表现就是"点适应屏幕没反应"。
   */
  notePress: () => void;
  /** 以某个屏幕点（默认窗口中心）为锚点缩放 */
  zoomAtAnchor: (factor: number, anchorX?: number, anchorY?: number) => void;
  /** 适应屏幕：整张底图完整可见并居中 */
  fit: () => void;
  /** 归一化坐标 → 视口窗口内的像素位置（区域名称与顶点手柄用） */
  toScreenPixel: (nx: number, ny: number) => [number, number];
}
