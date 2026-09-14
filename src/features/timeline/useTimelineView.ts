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
 * 泳道名称列的宽度（宽屏）。
 * 必须与三处保持一致，否则刻度尺与条目会错开一格：
 *   - 本常量（居中定位的换算要扣掉它）
 *   - TimelineAxis 里刻度尺左侧留白的 `w-36` / `max-md:w-20`
 *   - TimelineCanvas 里名称列的 `w-36` / `max-md:w-20`
 * 手机上收到 80px：144px 的名称列会吃掉 360px 屏幕的 40%，
 * 时间轴本体就没地方了。宽度跟着断点走，所以这里是两档值。
 */
export const LABEL_COL = 144;
/** 窄屏下的名称列宽度（对应 Tailwind 的 w-20） */
export const LABEL_COL_NARROW = 80;

/** 当前是否窄屏（与 Tailwind 的 md 断点一致） */
export function isNarrow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}

/**
 * 名称列当前占的宽度。
 * 它与内容在**同一个滚动容器**里（sticky 钉住），所以"能画图的宽度"
 * 永远是「容器宽度 − 名称列宽度」—— 适配与居中都必须扣掉它，
 * 否则内容会比可视区宽出一列，横向又冒出一条本不该有的滚动条。
 */
export function gutter(): number {
  return isNarrow() ? LABEL_COL_NARROW : LABEL_COL;
}

export function useTimelineView(fullRange: TimeRange) {
  /**
   * 内容范围（含留白）：范围变了要重新适配，所以用 memo 固定引用。
   * 右边多留一点给最右边的刻度值，否则刻度文字会把内容撑出视口。
   */
  const range = useMemo(() => padRange(fullRange, 0.06, 0.12), [fullRange.min, fullRange.max]);
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
        setPxPerUnit(fitPxPerUnit(range, width - gutter()));
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
    const next = fitPxPerUnit(range, (el?.clientWidth ?? viewportPx) - gutter());
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
      // 名称列在同一个滚动容器里（sticky 钉住），所以可用宽度要扣掉它，
      // 否则条目会被名称列压住一半 —— 点了却"看不到"。
      const left = scrollLeftToCenter(t, el.clientWidth, range, pxPerUnit, gutter());
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
