/**
 * 时间轴视图状态（比例尺 + 滚动 + 缩放锚点）
 * ==================================================================
 * 这是「放大后能拖滚动条看完整条时间轴」的落点。
 *
 * 与旧实现的区别：旧代码把缩放表达成「可见区间 viewport」，渲染按百分比定位，
 * 于是内容永远铺满容器宽、横向没有可滚动的像素。这里改成
 * 「内容总宽 = 跨度 × 比例尺」，滚动交给浏览器原生的横向滚动条。
 *
 * 关键细节：**缩放时必须补偿滚动位置**，否则鼠标指着的那一刻会跑掉，
 * 手感是"一缩放就不知道飘哪去了"。补偿公式在 scale.ts 里，有自测。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  contentWidth, fitPxPerUnit, padRange, scrollLeftToCenter, scrollLeftToKeep,
  timeToX, xToTime, zoomBy, type TimeRange,
} from './scale';

/**
 * 泳道名称列的宽度。
 * 必须与三处保持一致，否则刻度尺与条目会错开一格：
 *   - useTimelineView 的 LABEL_COL（本常量，用于居中定位的换算）
 *   - TimelineAxis 里刻度尺左侧留白的 `w-36`
 *   - TimelineCanvas 里名称列的 `w-36`
 * 单独提出来是为了让"改宽度时要改哪几处"这件事在代码里看得见。
 */
export const LABEL_COL = 144;

export function useTimelineView(fullRange: TimeRange) {
  /** 内容范围（含留白）：范围变了要重新适配，所以用 memo 固定引用 */
  const range = useMemo(() => padRange(fullRange), [fullRange.min, fullRange.max]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportPx, setViewportPx] = useState(900);
  /** 首次适配只做一次；之后用户自己缩放的位置不该被覆盖 */
  const fitted = useRef(false);

  /** 主题：视口尺寸变化时同步，并（首次）把整段刚好铺满 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => {
      const width = Math.max(120, el.clientWidth);
      setViewportPx(width);
      if (!fitted.current && width > 120) {
        fitted.current = true;
        setPxPerUnit(fitPxPerUnit(range, width));
      }
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [range]);

  /** 内容总宽：给内层容器定宽，浏览器才有东西可滚 */
  const width = contentWidth(range, pxPerUnit);

  const onScroll = useCallback(() => {
    setScrollLeft(scrollRef.current?.scrollLeft ?? 0);
  }, []);

  /**
   * 以某个视口内的位置为锚点缩放。
   * @param factor     > 1 放大
   * @param anchorPx   锚点在视口内的像素位置；不给就用视口中心
   */
  const zoomAt = useCallback(
    (factor: number, anchorPx?: number) => {
      const el = scrollRef.current;
      const at = anchorPx ?? viewportPx / 2;
      setPxPerUnit((prev) => {
        const next = zoomBy(prev, factor);
        // 先算出缩放后应该滚到哪里，再在下一帧设置：状态更新是异步的，
        // 但 scrollLeft 可以直接写 DOM，不必等 React 重渲染
        const anchorTime = xToTime((el?.scrollLeft ?? 0) + at, range, prev);
        const nextScroll = scrollLeftToKeep(anchorTime, at, range, next);
        requestAnimationFrame(() => {
          if (el) el.scrollLeft = Math.max(0, nextScroll);
        });
        return next;
      });
    },
    [range, viewportPx],
  );

  /** 适配全部条目：整段刚好铺满 */
  const fit = useCallback(() => {
    const el = scrollRef.current;
    const next = fitPxPerUnit(range, el?.clientWidth ?? viewportPx);
    setPxPerUnit(next);
    requestAnimationFrame(() => {
      if (el) el.scrollLeft = 0;
    });
  }, [range, viewportPx]);

  /** 把某个刻度滚到视口中央（「定位到该条目 / 这一刻」用） */
  const centerOn = useCallback(
    (t: number) => {
      const el = scrollRef.current;
      if (!el) return;
      // 名称列在滚动容器之外，所以容器宽度就是时间轴本体的宽度，不用扣偏移
      const left = scrollLeftToCenter(t, el.clientWidth, range, pxPerUnit);
      el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    },
    [range, pxPerUnit],
  );

  return {
    range, pxPerUnit, width, scrollLeft, viewportPx,
    scrollRef, onScroll, zoomAt, fit, centerOn,
    timeToX: (t: number) => timeToX(t, range, pxPerUnit),
  };
}
