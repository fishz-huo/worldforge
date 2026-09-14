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
 */
import type { TimelineEntry, Track } from '@/types';
import { entrySpan } from '@/types';
import { cn } from '@/lib/utils';
import type { DragPreview } from './useEntryDrag';

interface Props {
  track: Track;
  entries: TimelineEntry[];
  /** 刻度 → 内容像素 */
  toX: (t: number) => number;
  /** 比例尺（把"最小可见宽度"换算成刻度） */
  pxPerUnit: number;
  cursor: number | null;
  selectedEntryId: string | null;
  preview: DragPreview | null;
  onSelectEntry: (id: string) => void;
  onBeginDrag: (e: React.PointerEvent, entry: TimelineEntry, mode: 'move' | 'start' | 'end') => void;
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
            <button
              key={entry.id}
              onPointerDown={(e) => onBeginDrag(e, entry, 'move')}
              onClick={() => onSelectEntry(entry.id)}
              title={`${entry.title}\n${entry.start_t}${entry.note ? `\n${entry.note}` : ''}\n（拖动可改刻度，按住 Shift 吸附）`}
              className={cn(
                'absolute top-1/2 z-10 size-3.5 cursor-grab -translate-y-1/2 active:cursor-grabbing',
                active ? 'ring-2 ring-foreground/70' : 'hover:brightness-125',
              )}
              style={{ left, background: track.color, transform: 'translate(-50%, -50%) rotate(45deg)' }}
            />
          );
        }
        return (
          <div
            key={entry.id}
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

      {/* 数值折线（科技水平等） */}
      {track.valued === 1 && entries.length > 1 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <polyline
            points={[...entries]
              .sort((a, b) => a.start_t - b.start_t)
              .map((e) => `${toX(e.start_t)},${100 - Math.max(0, Math.min(100, Number(e.value ?? 0)))}`)
              .join(' ')}
            fill="none"
            stroke={track.color}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* 游标线 */}
      {cursor !== null && (
        <div className="pointer-events-none absolute inset-y-0 w-px bg-primary/60" style={{ left: toX(cursor) }} />
      )}
    </div>
  );
}
