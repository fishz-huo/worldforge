/**
 * 时间轴泳道
 * ------------------------------------------------------------------
 * 一条泳道渲染一个类别（事件 / 角色生命线 / 地理变化 / 科技水平 / 底层设定）。
 * - 瞬时事件画成菱形，有起止的事件画成条形（条形长度 = 持续时长）；
 * - 角色泳道在名称列显示「游标时刻的年龄」；
 * - valued 泳道（科技/数值）额外画折线，表现水平演进。
 */
import type { Card, TimelineEntry, Track, Viewport } from '@/types';
import { ageAt, entrySpan } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  track: Track;
  entries: TimelineEntry[];
  cards: Card[];
  viewport: Viewport;
  cursor: number | null;
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
}

export function TimelineLane({ track, entries, cards, viewport, cursor, selectedEntryId, onSelectEntry }: Props) {
  const span = Math.max(1e-6, viewport.end - viewport.start);
  const pct = (t: number) => ((t - viewport.start) / span) * 100;
  const minSpan = span * 0.004; // 瞬时事件的最小可见宽度

  /** 角色泳道的年龄推算：取该泳道第一条绑定角色卡 */
  const character = track.kind === 'character'
    ? cards.find((c) => c.id === entries.find((e) => e.card_id)?.card_id)
    : undefined;
  const birth = character ? Number(character.fields?.birth_t) : NaN;
  const age = cursor !== null && Number.isFinite(birth) ? ageAt(birth, cursor) : null;

  const height = track.valued ? 56 : 40;

  return (
    <div className="flex border-b border-border/60" style={{ height }}>
      {/* 泳道名称列 */}
      <div className="flex w-36 shrink-0 flex-col justify-center gap-0.5 border-r border-border bg-card/40 px-2">
        <span className="flex items-center gap-1.5 truncate text-[11px] font-medium">
          <span className="size-2 shrink-0 rounded-sm" style={{ background: track.color }} />
          <span className="truncate">{track.name}</span>
        </span>
        {track.kind === 'character' && (
          <span className="truncate text-[10px] text-muted-foreground">
            {age !== null ? `游标时 ${age} 岁` : character ? '未填出生刻度' : '未绑定角色卡'}
          </span>
        )}
        {track.valued === 1 && track.kind !== 'character' && (
          <span className="text-[10px] text-muted-foreground">数值型泳道</span>
        )}
      </div>

      {/* 泳道内容区 */}
      <div className="relative min-w-0 flex-1">
        {/* 纪元背景 */}
        {/* 条目 */}
        {entries.map((entry) => {
          const [from, to] = entrySpan(entry, minSpan);
          const left = pct(from);
          const width = Math.max(0.35, pct(to) - pct(from));
          if (left > 100 || left + width < 0) return null;
          const active = entry.id === selectedEntryId;
          const isInstant = entry.instant === 1 || entry.end_t === null;
          return (
            <button
              key={entry.id}
              onClick={() => onSelectEntry(entry.id)}
              className={cn(
                'absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 overflow-hidden px-1 text-left text-[10px] transition-all',
                isInstant ? 'size-3.5 !p-0' : 'h-5 rounded',
                active ? 'ring-2 ring-foreground/70' : 'hover:brightness-125',
              )}
              style={{
                left: `${left}%`,
                width: isInstant ? undefined : `${width}%`,
                background: isInstant ? track.color : `${track.color}cc`,
                transform: isInstant ? 'translate(-50%, -50%) rotate(45deg)' : undefined,
                color: '#0b1220',
              }}
              title={`${entry.title}\n${entry.start_t} → ${entry.end_t ?? '瞬时'}${entry.note ? `\n${entry.note}` : ''}`}
            >
              {!isInstant && <span className="truncate font-medium">{entry.title}</span>}
            </button>
          );
        })}

        {/* 数值折线（科技水平等） */}
        {track.valued === 1 && entries.length > 1 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline
              points={[...entries]
                .sort((a, b) => a.start_t - b.start_t)
                .map((e) => `${pct(e.start_t)},${100 - Math.max(0, Math.min(100, Number(e.value ?? 0)))}`)
                .join(' ')}
              fill="none"
              stroke={track.color}
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {/* 游标线 */}
        {cursor !== null && (
          <div className="pointer-events-none absolute inset-y-0 w-px bg-primary/60" style={{ left: `${pct(cursor)}%` }} />
        )}
      </div>
    </div>
  );
}
