/**
 * 拖动刻度尺 / 点泳道空白来选择时刻（游标）
 * ------------------------------------------------------------------
 * 需求：点泳道空白处也能控制游标，不只是点刻度尺。
 *
 * 坐标换算必须**只用滚动容器**做基准（`scroller.scrollLeft + 指针到容器左边的距离`），
 * 不能用事件所在元素自己的矩形：泳道那一格左边还压着 144px 的泳道名称列，
 * 用元素自己的 left 去算，同一像素会被换算成两个不同的时刻 ——
 * 表现就是"点在 100 年刻度上，游标却跳到 54 年"。
 *
 * 为什么不用 React 的 onPointerMove：拖动时指针很容易离开触发元素
 * （尤其在 40px 高的泳道里），必须靠 `setPointerCapture` 把后续事件
 * 钉在这个元素上；而"是否在拖动"放在 ref 里，避免每帧多一次重渲染。
 */
import { useCallback, useRef } from 'react';
import { xToTime, type TimeRange } from './scale';

interface Options {
  range: TimeRange;
  pxPerUnit: number;
  /** 横向滚动容器：坐标基准与滚动量都从它来 */
  getScroller: () => HTMLElement | null;
  onMove: (t: number) => void;
}

export function useCursorScrub({ range, pxPerUnit, getScroller, onMove }: Options) {
  const dragging = useRef(false);

  /** 指针 x（屏幕）→ 刻度：与刻度尺、泳道共用同一个内容坐标系 */
  const timeAt = useCallback(
    (clientX: number) => {
      const el = getScroller();
      if (!el) return NaN;
      const rect = el.getBoundingClientRect();
      return xToTime(el.scrollLeft + (clientX - rect.left), range, pxPerUnit);
    },
    [getScroller, range, pxPerUnit],
  );

  /** 绑到任何元素上：按下即把游标放到该位置，拖动时连续跟随 */
  const scrub = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = true;
      onMove(timeAt(e.clientX));
    },
    [onMove, timeAt],
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      // 左键按住才算拖动：右键/中键按下的 pointermove 不该动游标
      if (e.buttons !== 1) return;
      onMove(timeAt(e.clientX));
    },
    [onMove, timeAt],
  );

  const end = useCallback(() => {
    dragging.current = false;
  }, []);

  return { scrub, move, end };
}
