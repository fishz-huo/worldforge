/**
 * 时间轴刻度尺
 * ------------------------------------------------------------------
 * 纪元色带 + 刻度 + 当前时刻游标 + 两处拖动。
 *
 * 与旧实现的区别：刻度按**像素**摆放（不再是百分比），刻度步长由
 * 「屏幕上一格多少像素」决定 —— 所以放大时刻度会自动变密、变细，
 * 缩小时自动回到整十年这种粗刻度（见 scale.ts 的 visibleTicks）。
 *
 * 两种拖动：
 *   - 在刻度尺空白处按下 / 拖动 → 移动游标
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
  /** 横向滚轮：交给外层滚动容器，刻度尺自己不滚 */
  onScrollBy: (deltaPx: number) => void;
}

export function TimelineAxis({
  range, pxPerUnit, viewportPx, scrollLeft, eras, unit, cursor, onCursorChange, onEraChange,
  onScrollBy,
}: Props) {
  /** 刻度 → 内容像素 */
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
  const dragEra = (
    e: React.PointerEvent,
    era: Era,
    edge: 'start' | 'end',
  ) => {
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
    <div className="relative h-12 border-b border-border bg-card/30">
      {/* 左侧留白：与泳道名称列同宽，保证刻度与条目在同一竖线上。
          手机上收窄到 w-20 —— 144px 会吃掉 360px 屏幕的 40%，时间轴本体就没地方了。 */}
      <div className="absolute inset-y-0 left-0 w-36 border-r border-border bg-card/60 max-md:w-20" />

      <div
        className="absolute inset-y-0 left-36 right-0 cursor-crosshair max-md:left-20"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onCursorChange(timeAt(e.clientX, e.currentTarget));
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) onCursorChange(timeAt(e.clientX, e.currentTarget));
        }}
        onWheel={(e) => {
          // 横向滚轮（触控板横扫、Shift + 滚轮）在这里平移；纵向留给泳道区滚动
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) onScrollBy(e.deltaX);
          else if (e.shiftKey) onScrollBy(e.deltaY);
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
                className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/50"
              />
              <span
                onPointerDown={(e) => dragEra(e, era, 'end')}
                className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/50"
              />
            </div>
          );
        })}

        {/* 刻度 */}
        {ticks.map((t) => (
          <div key={t} className="absolute bottom-0 top-4 flex flex-col items-center" style={{ left: toX(t) }}>
            <span className="h-1.5 w-px bg-border" />
            <span className="mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
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
              cursor > range.max - (viewportPx / pxPerUnit) * 0.12 ? 'right-1' : 'left-1',
            )}>
              {Math.round(cursor * 100) / 100} {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
