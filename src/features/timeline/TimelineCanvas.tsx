/**
 * 时间轴画布
 * ------------------------------------------------------------------
 * 由「刻度尺 + 若干泳道」组成；负责把视图区间（viewport）传给子组件。
 * 缩放与平移都由父模块控制，本组件只做布局。
 */
import type { Card, Era, TimelineEntry, Track, Viewport } from '@/types';
import { TimelineAxis } from './TimelineAxis';
import { TimelineLane } from './TimelineLane';

interface Props {
  tracks: Track[];
  entries: TimelineEntry[];
  cards: Card[];
  eras: Era[];
  viewport: Viewport;
  unit: string;
  cursor: number | null;
  selectedEntryId: string | null;
  onCursorChange: (t: number) => void;
  onSelectEntry: (id: string) => void;
  onPan: (deltaT: number) => void;
}

export function TimelineCanvas({
  tracks, entries, cards, eras, viewport, unit, cursor, selectedEntryId,
  onCursorChange, onSelectEntry, onPan,
}: Props) {
  const visibleTracks = tracks.filter((t) => t.hidden !== 1);
  const span = Math.max(1e-6, viewport.end - viewport.start);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TimelineAxis
        viewport={viewport}
        eras={eras}
        unit={unit}
        cursor={cursor}
        onCursorChange={onCursorChange}
        onPan={onPan}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 纪元背景竖带（贯穿所有泳道） */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 z-0">
            {eras.map((era) => {
              const left = ((era.start_t - viewport.start) / span) * 100;
              const width = ((era.end_t - era.start_t) / span) * 100;
              if (left > 100 || left + width < 0) return null;
              return (
                <div
                  key={era.id}
                  className="absolute inset-y-0 opacity-[0.07]"
                  style={{
                    left: `${Math.max(0, left)}%`,
                    width: `${Math.max(0.2, Math.min(100, left + width) - Math.max(0, left))}%`,
                    background: era.color,
                  }}
                />
              );
            })}
          </div>
          <div className="relative z-10">
            {visibleTracks.map((track) => (
              <TimelineLane
                key={track.id}
                track={track}
                entries={entries.filter((e) => e.track_id === track.id)}
                cards={cards}
                viewport={viewport}
                cursor={cursor}
                selectedEntryId={selectedEntryId}
                onSelectEntry={onSelectEntry}
              />
            ))}
            {visibleTracks.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                还没有可见的泳道。用左下角「新建泳道」添加事件 / 角色生命线 / 地理变化等轨道。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
