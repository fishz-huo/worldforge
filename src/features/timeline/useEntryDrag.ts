/**
 * 时间轴条目的拖拽编辑（纯逻辑）
 * ==================================================================
 * 学 AE / PR 的操作逻辑：
 *   - 拖条的**中间** → 整体平移（起止同时移动，时长不变）
 *   - 拖条的**左 / 右把手** → 只改开始或结束刻度
 *   - 瞬时的菱形点 → 拖它就是改那一个刻度
 *   - 按住 Shift → 吸附到当前可见刻度
 *   - 拖到容器边缘 → 自动横向滚动（不然长距离拖动根本走不过去）
 *
 * 三条纪律：
 *   1. 拖动过程**只改本地预览**，松手才写库 —— 不然一次拖动会写几十次 SQLite；
 *   2. 结束刻度不允许小于开始刻度（拖过界就夹住），否则会得到一根
 *      "倒着走的条"，用户只会以为坏了；
 *   3. 松手提交时**读 ref 而不是 state** —— React 状态更新是异步的，
 *      在 pointerup 里读 state 会拿到上一次的值，表现是"拖了半天松手没反应"。
 *
 * 指针事件统一挂在最外层容器上（而不是每个条自己身上）：拖动时指针会离开
 * 那个小元素，靠容器 + setPointerCapture 才不会丢事件。
 */
import { useRef, useState } from 'react';
import { pxToSpan, snapTime, type TimeRange } from './scale';

/** 拖拽的三个落点 */
export type DragMode = 'move' | 'start' | 'end';

/** 拖动中的预览状态 */
export interface DragPreview {
  entryId: string;
  mode: DragMode;
  start_t: number;
  end_t: number | null;
}

/** 一次拖动会话 */
interface DragSession {
  entryId: string;
  mode: DragMode;
  /** 按下时的指针 x（屏幕坐标，不随滚动变化） */
  originX: number;
  /** 按下时的容器滚动位置：自动滚动产生的位移要补偿掉 */
  originScroll: number;
  /** 中途因自动滚动额外产生的刻度偏移 */
  scrollDeltaT: number;
  start_t: number;
  end_t: number | null;
  /** 松手时要提交的值（ref 给事件用，state 给渲染用） */
  latest: { start_t: number; end_t: number | null };
  moved: boolean;
}

interface DragOptions {
  range: TimeRange;
  pxPerUnit: number;
  viewportPx: number;
  /** 滚动容器（用于自动滚动与读取 scrollLeft） */
  getScroller: () => HTMLElement | null;
  /** 松手时提交（写库） */
  onCommit: (entryId: string, patch: { start_t: number; end_t: number | null }) => void;
}

/** 小于这个像素数当成点击，不产生改动 */
const CLICK_SLOP = 3;
/** 拖到距边缘多少像素开始自动滚动 */
const EDGE_PX = 48;

export function useEntryDrag({ range, pxPerUnit, viewportPx, getScroller, onCommit }: DragOptions) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const session = useRef<DragSession | null>(null);

  /** 按下：记录起点（指针捕获交给容器上的 pointerup 兜底） */
  const begin = (
    e: React.PointerEvent,
    entry: { id: string; start_t: number; end_t: number | null },
    mode: DragMode,
  ) => {
    e.stopPropagation();
    const el = getScroller();
    session.current = {
      entryId: entry.id,
      mode,
      originX: e.clientX,
      originScroll: el?.scrollLeft ?? 0,
      scrollDeltaT: 0,
      start_t: entry.start_t,
      end_t: entry.end_t,
      latest: { start_t: entry.start_t, end_t: entry.end_t },
      moved: false,
    };
  };

  /** 由像素位移与自动滚动量算出新的起止 */
  const compute = (clientX: number, shift: boolean): { start_t: number; end_t: number | null } | null => {
    const st = session.current;
    if (!st) return null;
    const el = getScroller();
    const scrolled = (el?.scrollLeft ?? 0) - st.originScroll;
    const dxPx = clientX - st.originX + scrolled;
    const dt = pxToSpan(dxPx, pxPerUnit) + st.scrollDeltaT;
    const snap = (t: number) =>
      (shift ? snapTime(t, range, pxPerUnit, viewportPx) : Math.round(t * 1000) / 1000);

    if (st.mode === 'move') {
      return {
        start_t: snap(st.start_t + dt),
        end_t: st.end_t === null ? null : snap(st.end_t + dt),
      };
    }
    if (st.mode === 'start') {
      const hardMax = st.end_t === null ? st.start_t : st.end_t;
      return { start_t: Math.min(snap(st.start_t + dt), hardMax), end_t: st.end_t };
    }
    const hardMin = st.start_t;
    return { start_t: st.start_t, end_t: st.end_t === null ? null : Math.max(snap(st.end_t + dt), hardMin) };
  };

  /**
   * 移动：更新预览 + 贴边自动滚动。
   * 自动滚动的位移会被换算成刻度补偿进 dxPx，所以"拖着往右滚"时
   * 条会稳稳跟着指针走，而不会越拖越落后。
   */
  const move = (e: React.PointerEvent) => {
    const st = session.current;
    if (!st) return;
    if (Math.abs(e.clientX - st.originX) < CLICK_SLOP && !st.moved) return; // 还当成点击
    st.moved = true;

    const el = getScroller();
    if (el) {
      const rect = el.getBoundingClientRect();
      if (e.clientX > rect.right - EDGE_PX) {
        el.scrollLeft += 12;
        st.scrollDeltaT += pxToSpan(12, pxPerUnit);
      } else if (e.clientX < rect.left + EDGE_PX) {
        el.scrollLeft -= 12;
        st.scrollDeltaT -= pxToSpan(12, pxPerUnit);
      }
    }

    const next = compute(e.clientX, e.shiftKey);
    if (!next) return;
    st.latest = next;
    setPreview({ entryId: st.entryId, mode: st.mode, ...next });
  };

  /**
   * 松手：提交改动。
   * @returns 这次拖动有没有真的改到东西（调用方据此吞掉随后的点击）
   */
  const end = (): boolean => {
    const st = session.current;
    session.current = null;
    setPreview(null);
    if (!st || !st.moved) return false;
    const { start_t, end_t } = st.latest;
    if (start_t === st.start_t && end_t === st.end_t) return false; // 数值没变，不写库
    onCommit(st.entryId, { start_t, end_t });
    return true;
  };

  /** 拖动被系统取消（例如触屏手势被接管）时清理，不提交 */
  const cancel = () => {
    session.current = null;
    setPreview(null);
  };

  return { preview, begin, move, end, cancel };
}
