/**
 * Timeline Slice —— 泳道、时间轴条目、纪元
 * ------------------------------------------------------------------
 * 需求 3：可视化时间轴，并把「事件 / 角色 / 地理 / 科技 / 底层设定」串到一张图上。
 * 刻度是数值（可为负），显示时由 world.meta.time 的 unit / zeroLabel 翻译。
 */
import type { Era, TimelineEntry, Track, TrackKind } from '@/types';
import { TRACK_KINDS } from '@/types';
import { newEntryId, newEraId, newTrackId } from '@/lib/id';
import { entriesRepo, erasRepo, tracksRepo } from '@/lib/db';
import { nextOrder, removeById, removeWhere, upsert } from '../helpers';
import type { Slice } from '../types';

export interface TimelineSlice {
  createTrack: (name: string, kind?: TrackKind) => string;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  /** 新建时间轴条目 */
  addEntry: (trackId: string, init: Partial<TimelineEntry> & { start_t: number }) => string;
  updateEntry: (id: string, patch: Partial<TimelineEntry>) => void;
  deleteEntry: (id: string) => void;
  /** 由卡片自动生成条目（事件卡用 start/end 刻度，角色卡用出生/死亡） */
  entryFromCard: (cardId: string, trackId: string) => string | null;
  createEra: (name: string, start?: number, end?: number) => string;
  updateEra: (id: string, patch: Partial<Era>) => void;
  deleteEra: (id: string) => void;
}

export const createTimelineSlice: Slice<TimelineSlice> = (set, get) => ({
  createTrack: (name, kind = 'event') => {
    const worldId = get().currentWorldId;
    if (!worldId) return '';
    const meta = TRACK_KINDS.find((k) => k.kind === kind) ?? TRACK_KINDS[0];
    const track: Track = {
      id: newTrackId(),
      world_id: worldId,
      branch_id: get().currentBranchId,
      name,
      kind,
      color: meta.color,
      order_index: nextOrder(get().tracks),
      hidden: 0,
      valued: kind === 'tech' ? 1 : 0,
    };
    tracksRepo.save(track);
    set({ tracks: [...get().tracks, track] });
    return track.id;
  },

  updateTrack: (id, patch) => {
    const track = get().tracks.find((t) => t.id === id);
    if (!track) return;
    const next = { ...track, ...patch };
    tracksRepo.save(next);
    set({ tracks: upsert(get().tracks, next) });
  },

  deleteTrack: (id) => {
    tracksRepo.remove(id);
    entriesRepo.removeWhere('track_id = ?', [id]);
    set({
      tracks: removeById(get().tracks, id),
      entries: removeWhere(get().entries, (e) => e.track_id === id),
    });
  },

  addEntry: (trackId, init) => {
    const worldId = get().currentWorldId;
    if (!worldId) return '';
    const end = init.end_t ?? null;
    const entry: TimelineEntry = {
      id: newEntryId(),
      world_id: worldId,
      branch_id: init.branch_id ?? get().currentBranchId,
      track_id: trackId,
      card_id: init.card_id ?? null,
      title: init.title ?? '新条目',
      start_t: init.start_t,
      end_t: end,
      instant: init.instant ?? (end === null ? 1 : 0),
      note: init.note ?? '',
      state: init.state ?? '',
      value: init.value ?? null,
      map_id: init.map_id ?? null,
      created_at: Date.now(),
    };
    entriesRepo.save(entry);
    set({ entries: [...get().entries, entry], selectedEntryId: entry.id });
    return entry.id;
  },

  updateEntry: (id, patch) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    const merged = { ...entry, ...patch };
    // end_t 被清空时自动切回瞬时事件
    if ('end_t' in patch && (patch.end_t === null || patch.end_t === undefined)) merged.instant = 1;
    else if ('end_t' in patch) merged.instant = 0;
    entriesRepo.save(merged);
    set({ entries: upsert(get().entries, merged) });
  },

  deleteEntry: (id) => {
    entriesRepo.remove(id);
    set({
      entries: removeById(get().entries, id),
      selectedEntryId: get().selectedEntryId === id ? null : get().selectedEntryId,
    });
  },

  entryFromCard: (cardId, trackId) => {
    const card = get().cards.find((c) => c.id === cardId);
    if (!card) return null;
    const num = (key: string): number | null => {
      const raw = card.fields?.[key];
      if (raw === undefined || raw === null || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    if (card.type === 'event') {
      const start = num('start_t');
      if (start === null) {
        get().toast('该事件卡还没有填写「开始刻度」', 'warn');
        return null;
      }
      return get().addEntry(trackId, {
        card_id: card.id,
        title: card.title,
        start_t: start,
        end_t: num('end_t'),
        note: card.summary,
      });
    }
    if (card.type === 'character') {
      const birth = num('birth_t');
      const death = num('death_t');
      if (birth === null) {
        get().toast('该角色卡还没有填写「出生刻度」', 'warn');
        return null;
      }
      return get().addEntry(trackId, {
        card_id: card.id,
        title: card.title,
        start_t: birth,
        end_t: death,
        note: card.summary,
        state: String(card.fields?.identity ?? ''),
      });
    }
    return get().addEntry(trackId, { card_id: card.id, title: card.title, start_t: 0, note: card.summary });
  },

  createEra: (name, start, end) => {
    const worldId = get().currentWorldId;
    if (!worldId) return '';
    const cfg = get().worlds.find((w) => w.id === worldId)?.meta?.time;
    const era: Era = {
      id: newEraId(),
      world_id: worldId,
      name,
      start_t: start ?? cfg?.defaultStart ?? 0,
      end_t: end ?? cfg?.defaultEnd ?? 100,
      color: '#334155',
      note: '',
    };
    erasRepo.save(era);
    set({ eras: [...get().eras, era].sort((a, b) => a.start_t - b.start_t) });
    return era.id;
  },

  updateEra: (id, patch) => {
    const era = get().eras.find((e) => e.id === id);
    if (!era) return;
    const next = { ...era, ...patch };
    erasRepo.save(next);
    set({ eras: upsert(get().eras, next).sort((a, b) => a.start_t - b.start_t) });
  },

  deleteEra: (id) => {
    erasRepo.remove(id);
    set({ eras: removeById(get().eras, id) });
  },
});
