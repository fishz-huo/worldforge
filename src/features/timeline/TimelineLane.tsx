/**
 * 时间轴泳道（内容区）
 * ------------------------------------------------------------------
 * 一条泳道渲染一个类别（事件 / 角色生命线 / 地理变化 / 科技水平 / 底层设定）。
 * - 瞬时事件画成菱形，有起止的事件画成条形（条形长度 = 持续时长）；
 * - 条形中段可拖动平移，两端各有一个把手可拉伸（见 useEntryDrag）；
 * - valued 泳道（科技/数值）额外画折线，表现水平演进。
 *
 * 坐标从"百分比"换成了"像素"：内容总宽由比例尺算出（见 scale.ts），
 * 所以这里的定位一律是绝对像素，横向滚动交给外面的滚动容器。
 *
 * **本组件的坐标系以自己左上角为原点**（`toX(0)` 贴着自己的左边缘）：
 * 泳道被摆在名称列右边，若直接用"内容坐标"，绝对定位参照的是泳道自己，
 * 于是每条泳道里的东西都会比刻度尺多偏一个名称列的宽度 ——
 * 这正是"条目/游标和刻度对不上"的来源。调用方用 `toLaneX` 换算好再传进来。
 */
import type { TimelineEntry, Track } from '@/types';
import { entrySpan } from '@/types';
import { cn } from '@/lib/utils';
import type { DragPreview } from './useEntryDrag';

interface Props {
  track: Track;
  entries: TimelineEntry[];
  /** 刻度 → 本泳道内的像素（已经扣掉名称列与内容左端） */
  toX: (t: number) => number;
  /** 比例尺（把"最小可见宽度"换算成刻度） */
  pxPerUnit: number;
  cursor: number | null;
  selectedEntryId: string | null;
  preview: DragPreview | null;
  onSelectEntry: (id: string) => void;
  onBeginDrag: (e: React.PointerEvent, entry: TimelineEntry, mode: 'move' | 'start' | 'end') => void;
}

/** 数值 → 泳道内的 y（0 在下、100 在上，留出上下边距免得贴边） */
function valueY(value: unknown, height: number): number {
  const v = Math.max(0, Math.min(100, Number(value ?? 0)));
  return height - 6 - (v / 100) * (height - 12);
}

/**
 * 阶梯折线的顶点。
 * 每个条目画「自己的时段」，所以把条目按开始刻度排序后逐段连：
 * 先水平走到下一个条目的开始处，再竖直跳到新值。
 */
function stepPoints(
  entries: TimelineEntry[],
  toX: (t: number) => number,
  height: number,
): string {
  const sorted = [...entries].sort((a, b) => a.start_t - b.start_t);
  const out: string[] = [];
  sorted.forEach((e, i) => {
    const x = toX(e.start_t);
    const y = valueY(e.value, height);
    const next = sorted[i + 1];
    // 竖直跳变：先补一个同 x 的旧值点，线才会是直角而不是斜的
    if (i > 0) out.push(`${x},${valueY(sorted[i - 1].value, height)}`);
    out.push(`${x},${y}`);
    out.push(`${next ? toX(next.start_t) : toX(e.end_t ?? e.start_t)},${y}`);
  });
  return out.join(' ');
}

export function TimelineLane({
  track, entries, toX, pxPerUnit, cursor, selectedEntryId, preview,
  onSelectEntry, onBeginDrag,
}: Props) {
  /** 瞬时事件的最小可见宽度（像素）→ 刻度 */
  const minSpan = 8 / pxPerUnit;
  const height = track.valued ? 56 : 40;

  return (
    <div className="relative border-b border-border/60" style={{ height }}>
      {entries.map((entry) => {
        // 拖动中优先用预览值，松手后自动回到卡片里的真实值
        const live = preview && preview.entryId === entry.id
          ? { ...entry, start_t: preview.start_t, end_t: preview.end_t }
          : entry;
        const [from, to] = entrySpan(live, minSpan);
        const left = toX(from);
        const width = Math.max(6, toX(to) - left);
        const active = entry.id === selectedEntryId;
        const isInstant = entry.instant === 1 || entry.end_t === null;
        const dragging = preview?.entryId === entry.id;

        if (isInstant) {
          return (
            // 包一层并 stopPropagation：容器上的 pointerdown 是"选时刻"，
            // 点到条目时不能再顺手把游标也挪走
            <span
              key={entry.id}
              className="absolute top-1/2 z-10 -translate-y-1/2"
              style={{ left }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                onPointerDown={(e) => onBeginDrag(e, entry, 'move')}
                onClick={() => onSelectEntry(entry.id)}
                title={`${entry.title}\n${entry.start_t}${entry.note ? `\n${entry.note}` : ''}\n（拖动可改刻度，按住 Shift 吸附）`}
                className={cn(
                  'block size-3.5 cursor-grab active:cursor-grabbing',
                  active ? 'ring-2 ring-foreground/70' : 'hover:brightness-125',
                )}
                style={{ background: track.color, transform: 'translate(-50%, -50%) rotate(45deg)' }}
              />
            </span>
          );
        }
        return (
          <div
            key={entry.id}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              'absolute top-1/2 z-10 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded text-[10px]',
              active ? 'ring-2 ring-foreground/70' : '',
              dragging ? 'opacity-80' : '',
            )}
            style={{ left, width, background: `${track.color}cc`, color: '#0b1220' }}
          >
            {/* 左把手 */}
            <span
              onPointerDown={(e) => onBeginDrag(e, entry, 'start')}
              title="拖动改开始刻度"
              className="h-full w-1.5 shrink-0 cursor-ew-resize bg-black/20 hover:bg-black/40"
            />
            {/* 中段：拖动整体平移 */}
            <button
              onPointerDown={(e) => onBeginDrag(e, entry, 'move')}
              onClick={() => onSelectEntry(entry.id)}
              title={`${entry.title}\n${entry.start_t} → ${entry.end_t ?? '瞬时'}${entry.note ? `\n${entry.note}` : ''}\n（拖动平移，拖两端改起止，按住 Shift 吸附）`}
              className="h-full min-w-0 flex-1 cursor-grab truncate px-1 text-left font-medium active:cursor-grabbing"
            >
              {entry.title}
            </button>
            {/* 右把手 */}
            <span
              onPointerDown={(e) => onBeginDrag(e, entry, 'end')}
              title="拖动改结束刻度"
              className="h-full w-1.5 shrink-0 cursor-ew-resize bg-black/20 hover:bg-black/40"
            />
          </div>
        );
      })}

      {/*
        数值折线（灵息浓度、科技水平这类"某个量随时间的水平"）。
        画法是**阶梯**：每个数值在自己的时段内保持水平，换段时竖直跳一格。
        为什么不是把几个点直接连起来：那种画法在数据点之间插了并不存在的
        过渡，而且当一个中间值特别高时，线会从中间那条的上方跨过去 ——
        看起来就像"底下多了两条莫名其妙的斜线"（用户报的就是这个：
        「加高两尺」底下那两条、以及「灵息浓度」那条从头斜到尾的长线）。
        阶梯 + 每个测量点一个小圆点：一眼能看出"这是测出来的水平线"。
      */}
      {track.valued === 1 && entries.length > 1 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <polyline
            points={stepPoints(entries, toX, height)}
            fill="none"
            stroke={track.color}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          {entries.map((e) => (
            <circle
              key={e.id}
              cx={toX(e.start_t)}
              cy={valueY(e.value, height)}
              r={2.5}
              fill={track.color}
            />
          ))}
        </svg>
      )}

      {/* 游标线 */}
      {cursor !== null && (
        <div className="pointer-events-none absolute inset-y-0 w-px bg-primary/60" style={{ left: toX(cursor) }} />
      )}
    </div>
  );
}
