/**
 * Ctrl / Cmd + 滚轮缩放（以指针为锚点）
 * ------------------------------------------------------------------
 * 为什么用原生 addEventListener 而不是 React 的 onWheel：
 * React 把事件委托在根节点上，而根节点上的 wheel 监听是**被动**的
 * （passive: true），里面调用 preventDefault 会被忽略并打印警告 ——
 * 结果是浏览器自己把 Ctrl+滚轮当成"页面缩放"，时间轴反而没缩放。
 *
 * 普通滚轮不拦：留给容器做原生滚动（Shift/横向滚轮、触控板横扫都能用）。
 */
import { useEffect } from 'react';

export function useCtrlWheelZoom(
  scrollRef: React.RefObject<HTMLElement | null>,
  onZoomAt: (factor: number, anchorPx: number) => void,
): void {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      onZoomAt(e.deltaY > 0 ? 0.8 : 1.25, e.clientX - rect.left);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollRef, onZoomAt]);
}
