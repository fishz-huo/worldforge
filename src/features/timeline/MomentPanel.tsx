/**
 * 游标时刻快照面板
 * ------------------------------------------------------------------
 * 需求 3 的落点：把游标拖到任意刻度，立刻看到
 *  - 每个角色此刻的年龄与状态；
 *  - 此刻正在发生的所有事件（含该事件关联的地图）；
 * 这就是「某个时间点上的世界观切片」。
 */
import { useMemo } from 'react';
import { CalendarClock, Clock, MapPin, User } from 'lucide-react';
import { EmptyState, SectionTitle } from '@/components/ui/primitives';
import { ageAt } from '@/types';
import { useStore } from '@/store';

export function MomentPanel({ cursor }: { cursor: number | null }) {
  const cards = useStore((s) => s.cards);
  const tracks = useStore((s) => s.tracks);
  const entries = useStore((s) => s.entries);
  const maps = useStore((s) => s.maps);
  const selectEntry = useStore((s) => s.selectEntry);
  const unit = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId)?.meta?.time?.unit ?? '年');

  /** 该时刻正在进行的条目（区间重叠判定） */
  const active = useMemo(() => {
    if (cursor === null) return [];
    return entries.filter((e) => {
      const end = e.end_t ?? e.start_t;
      const from = Math.min(e.start_t, end);
      const to = Math.max(e.start_t, end);
      const pad = (to - from) * 0.02 + 1e-6;
      return cursor >= from - pad && cursor <= to + pad;
    });
  }, [entries, cursor]);

  /** 角色在该时刻的年龄与状态 */
  const ages = useMemo(() => {
    if (cursor === null) return [];
    return tracks
      .filter((t) => t.kind === 'character')
      .map((track) => {
        const entry = entries.find((e) => e.track_id === track.id && e.card_id);
        const card = cards.find((c) => c.id === entry?.card_id);
        const birth = card ? Number(card.fields?.birth_t) : NaN;
        if (!card || !Number.isFinite(birth)) return null;
        const death = Number(card.fields?.death_t);
        const dead = Number.isFinite(death) && cursor > death;
        const state = entries
          .filter((e) => e.track_id === track.id && e.start_t <= cursor && (e.end_t === null || e.end_t >= cursor))
          .map((e) => e.state || e.title)
          .filter(Boolean)
          .pop();
        return { track, card, age: ageAt(birth, cursor), dead, state };
      })
      .filter(Boolean) as {
      track: { id: string; name: string; color: string };
      card: { id: string; title: string };
      age: number | null;
      dead: boolean;
      state?: string;
    }[];
  }, [tracks, entries, cards, cursor]);

  if (cursor === null) {
    return (
      <EmptyState
        icon={<CalendarClock />}
        title="拖动刻度尺选择时刻"
        description="在上方刻度尺上拖动游标，这里会显示该时刻的角色年龄、状态与正在发生的事件。"
      />
    );
  }

  return (
    <div className="space-y-3 p-2">
      <div className="rounded-md border border-primary/40 bg-primary/10 p-2">
        <div className="text-[10px] text-muted-foreground">当前时刻</div>
        <div className="text-sm font-semibold">
          {Math.round(cursor * 100) / 100} {unit}
        </div>
      </div>

      <section>
        <SectionTitle>
          <span className="flex items-center gap-1">
            <User className="size-3" /> 角色状态（{ages.length}）
          </span>
        </SectionTitle>
        {ages.length === 0 && <div className="px-2 text-[11px] text-muted-foreground">没有可推算年龄的角色泳道</div>}
        {ages.map((a) => (
          <div key={a.track.id} className="space-y-0.5 rounded px-2 py-1 hover:bg-accent/50">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-sm" style={{ background: a.track.color }} />
              <span className="min-w-0 flex-1 truncate">{a.card.title}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {a.dead ? '已故' : a.age !== null ? `${a.age} 岁` : '—'}
              </span>
            </div>
            {a.state && <div className="pl-3.5 text-[10px] text-muted-foreground">{a.state}</div>}
          </div>
        ))}
      </section>

      <section>
        <SectionTitle>
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> 此刻正在发生（{active.length}）
          </span>
        </SectionTitle>
        {active.length === 0 && <div className="px-2 text-[11px] text-muted-foreground">此刻没有事件</div>}
        {active.map((e) => {
          const track = tracks.find((t) => t.id === e.track_id);
          const map = maps.find((m) => m.id === e.map_id);
          return (
            <button
              key={e.id}
              onClick={() => selectEntry(e.id)}
              className="flex w-full items-start gap-1.5 rounded px-2 py-1 text-left hover:bg-accent"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: track?.color ?? '#888' }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{e.title}</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {track?.name}
                  {e.state && ` · ${e.state}`}
                  {map && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="size-2.5" />
                      {map.name}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
