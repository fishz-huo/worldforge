/**
 * 时间轴刻度尺
 * ------------------------------------------------------------------
 * 纪元色带 + 刻度 + 当前时刻游标。
 * 刻度用「好看的步长」（1/2/5 × 10ⁿ）自动生成，避免出现 3.333 这种数字。
 */
import { useMemo, useRef } from 'react';
import type { Era, Viewport } from '@/types';
import { niceStep } from '@/types';

interface Props {
  viewport: Viewport;
  eras: Era[];
  unit: string;
  cursor: number | null;
  onCursorChange: (t: number) => void;
  onPan: (deltaT: number) => void;
}

export function TimelineAxis({ viewport, eras, unit, cursor, onCursorChange, onPan }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const span = Math.max(1e-6, viewport.end - viewport.start);

  /** 刻度序列 */
  const ticks = useMemo(() => {
    const step = niceStep(span, Math.max(4, Math.round((ref.current?.clientWidth ?? 900) / 110)));
    const first = Math.ceil(viewport.start / step) * step;
    const out: number[] = [];
    for (let t = first; t <= viewport.end; t += step) out.push(Math.round(t * 1000) / 1000);
    return out;
  }, [span, viewport.start, viewport.end]);

  /** 把刻度换算成百分比位置 */
  const pct = (t: number) => ((t - viewport.start) / span) * 100;

  /** 拖动游标 */
  const dragCursor = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onCursorChange(viewport.start + ratio * span);
  };

  return (
    <div className="relative h-12 select-none border-b border-border bg-card/30">
      {/* 左侧留白，与泳道名称列对齐 */}
      <div className="absolute inset-y-0 left-0 w-36 border-r border-border bg-card/60" />
      <div
        ref={ref}
        className="absolute inset-y-0 left-36 right-0 cursor-crosshair"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragCursor(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) dragCursor(e.clientX);
        }}
        onWheel={(e) => {
          // 滚轮横向平移（纵向留给页面滚动）
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) onPan((e.deltaX / 300) * span);
        }}
      >
        {/* 纪元色带 */}
        {eras.map((era) => {
          const left = pct(era.start_t);
          const right = pct(era.end_t);
          if (right < 0 || left > 100) return null;
          return (
            <div
              key={era.id}
              className="absolute top-0 h-3 rounded-b"
              style={{
                left: `${Math.max(0, left)}%`,
                width: `${Math.max(0.5, Math.min(100, right) - Math.max(0, left))}%`,
                background: era.color,
              }}
              title={`${era.name}（${era.start_t} → ${era.end_t}）${era.note ? ` · ${era.note}` : ''}`}
            />
          );
        })}

        {/* 刻度 */}
        {ticks.map((t) => (
          <div key={t} className="absolute bottom-0 top-3 flex flex-col items-center" style={{ left: `${pct(t)}%` }}>
            <span className="h-1.5 w-px bg-border" />
            <span className="mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
              {t} {unit}
            </span>
          </div>
        ))}

        {/* 当前时刻游标 */}
        {cursor !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary"
            style={{ left: `${pct(cursor)}%` }}
          >
            <span className="absolute -left-1 top-3 size-2 rounded-full bg-primary" />
            <span className="absolute left-1 top-3 whitespace-nowrap rounded bg-primary px-1 text-[10px] text-primary-foreground">
              {Math.round(cursor * 100) / 100} {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
