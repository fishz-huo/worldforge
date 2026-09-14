/**
 * 时间轴刻度尺
 * ------------------------------------------------------------------
 * 纪元色带 + 刻度 + 当前时刻游标 + 两处拖动。
 *
 * 关键约束（v0.2.1 修正）：**刻度尺必须与泳道在同一个横向滚动坐标系里**。
 * 之前刻度尺在一个"假滚动"容器里、自己维护一份 left 内边距，而泳道在
 * 真正的滚动容器里 —— 两边只要有 1px 的理解差异，刻度、游标和条目就会
 * 整体错开（用户看到的是"刻度尺和泳道对不上、游标也不在刻度上"）。
 * 现在刻度尺就是滚动内容的第一个子元素，`toX` 与泳道用的是同一个函数。
 *
 * 两种拖动：
 *   - 在刻度尺上按下 / 拖动 → 移动游标
 *   - 拖纪元色带的两端 → 改这个纪元的起止刻度
 */
import type { Era } from '@/types';
import { cn } from '@/lib/utils';
import { niceStep, visibleTicks, xToTime, type TimeRange } from './scale';

interface Props {
  range: TimeRange;
  pxPerUnit: number;
  viewportPx: number;
  scrollLeft: number;
  eras: Era[];
  unit: string;
  cursor: number | null;
  onCursorChange: (t: number) => void;
  /** 拖动纪元边界时提交 */
  onEraChange: (id: string, patch: { start_t?: number; end_t?: number }) => void;
}

export function TimelineAxis({
  range, pxPerUnit, viewportPx, scrollLeft, eras, unit, cursor, onCursorChange, onEraChange,
}: Props) {
  /** 刻度 → 内容像素（与泳道共用同一个坐标系） */
  const toX = (t: number) => (t - range.min) * pxPerUnit;
  const ticks = visibleTicks(range, pxPerUnit, viewportPx, scrollLeft);

  /** 指针 x（屏幕）→ 刻度；拖动纪元与游标共用 */
  const timeAt = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return xToTime(scrollLeft + (clientX - rect.left), range, pxPerUnit);
  };

  /**
   * 拖纪元边界。
   * 与条目拖拽一样：拖动过程直接写 style（不经过 React 状态），
   * 否则每移动一像素都要重渲染整条时间轴。
   */
  const dragEra = (e: React.PointerEvent, era: Era, edge: 'start' | 'end') => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const host = target.parentElement as HTMLElement | null;
    if (!host) return;
    const step = niceStep(viewportPx / pxPerUnit, Math.max(1, Math.floor(viewportPx / 90)));
    let latest = edge === 'start' ? era.start_t : era.end_t;

    const onMove = (ev: PointerEvent) => {
      let t = timeAt(ev.clientX, host);
      if (ev.shiftKey) t = Math.round(t / step) * step;
      // 起止不允许交叉：至少留一个刻度步长的宽度
      latest = edge === 'start'
        ? Math.min(Math.round(t * 1000) / 1000, era.end_t - step / 10)
        : Math.max(Math.round(t * 1000) / 1000, era.start_t + step / 10);
      const band = target.closest('[data-era-band]') as HTMLElement | null;
      if (band) {
        if (edge === 'start') {
          band.style.left = `${toX(latest)}px`;
          band.style.width = `${Math.max(2, toX(era.end_t) - toX(latest))}px`;
        } else {
          band.style.width = `${Math.max(2, toX(latest) - toX(era.start_t))}px`;
        }
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const patch = edge === 'start' ? { start_t: latest } : { end_t: latest };
      if ((edge === 'start' ? era.start_t : era.end_t) !== latest) onEraChange(era.id, patch);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className="relative h-12 cursor-crosshair border-b border-border bg-card/30"
      title="点击 / 拖动选择时刻"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onCursorChange(timeAt(e.clientX, e.currentTarget));
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) onCursorChange(timeAt(e.clientX, e.currentTarget));
      }}
    >
      {/* 纪元色带（可拖两端改起止） */}
      {eras.map((era) => {
        const left = toX(era.start_t);
        const width = Math.max(2, toX(era.end_t) - toX(era.start_t));
        if (left > scrollLeft + viewportPx || left + width < scrollLeft) return null;
        return (
          <div
            key={era.id}
            data-era-band
            className="group absolute top-0 h-4 rounded-b"
            style={{ left, width, background: era.color }}
            title={`${era.name}（${era.start_t} → ${era.end_t}）\n拖两端可改起止${era.note ? `\n${era.note}` : ''}`}
          >
            <span
              onPointerDown={(e) => dragEra(e, era, 'start')}
              className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/50 opacity-0 group-hover:opacity-100"
            />
            <span
              onPointerDown={(e) => dragEra(e, era, 'end')}
              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/50 opacity-0 group-hover:opacity-100"
            />
          </div>
        );
      })}

      {/* 刻度：竖线画在刻度位置上，数字左对齐挂在竖线右侧 —— 
          刻度线与刻度值都从同一个 x 出发，不会出现"数字居中、线在别处" */}
      {ticks.map((t) => (
        <div key={t} className="pointer-events-none absolute bottom-0 top-4" style={{ left: toX(t) }}>
          <span className="block h-1.5 w-px bg-border" />
          <span className="mt-0.5 block whitespace-nowrap pl-1 text-[10px] text-muted-foreground">
            {t} {unit}
          </span>
        </div>
      ))}

      {/* 当前时刻游标 */}
      {cursor !== null && !Number.isNaN(cursor) && (
        <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary" style={{ left: toX(cursor) }}>
          <span className="absolute -left-1 top-4 size-2 rounded-full bg-primary" />
          <span className={cn(
            'absolute top-4 whitespace-nowrap rounded bg-primary px-1 text-[10px] text-primary-foreground',
            // 靠近右边缘时把标签放到左边，免得被容器裁掉
            toX(cursor) > toX(range.max) - 80 ? 'right-1' : 'left-1',
          )}>
            {Math.round(cursor * 100) / 100} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
