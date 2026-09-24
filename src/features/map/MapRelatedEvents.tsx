/**
 * 「关联事件」小节（浮窗与底部抽屉共用）
 * ==================================================================
 * 数据来自时间轴条目（store.entries）。时间轴条目身上只有两个和地图有关的
 * 字段：card_id（从卡片生成 / 手动绑定卡片）与 map_id（条目编辑器里可选的
 * 「关联地图」）—— **没有区域级的关联列**。所以：
 *   - 标记点绑了卡片 → 查这张卡片的事件；
 *   - 区域 → 按 map_id 查「本地图关联的事件」，标题里写明是本地图的，
 *     免得用户以为系统知道"这个多边形对应哪几条事件"。
 * 要看区域级关联得给表加列（动数据库），本轮明确不做。
 */
import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { readTimeConfig } from '@/types';
import type { TimelineEntry } from '@/types';
import { useStore } from '@/store';

/** 浮窗里最多列几条：再多就撑破浮窗了，完整列表在时间轴模块里看 */
const MAX_ITEMS = 4;

/** 刻度显示：瞬时事件是单点，有跨度的写成 100–150 */
function spanOf(entry: TimelineEntry, unit: string): string {
  if (entry.instant || entry.end_t === null) return `${entry.start_t}${unit}`;
  return `${entry.start_t}–${entry.end_t}${unit}`;
}

export function MapRelatedEvents({
  cardId,
  mapId,
  scopeNote,
}: {
  cardId?: string | null;
  mapId?: string | null;
  /** 是否是「按地图」查的（区域用），标题里要说明 */
  scopeNote?: boolean;
}) {
  // selector 只取原始引用，派生数据一律 useMemo（见 MapOverview 的白屏教训）
  const entries = useStore((s) => s.entries);
  const world = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId));
  const unit = readTimeConfig(world?.meta).unit;

  const items = useMemo(() => {
    if (!cardId && !mapId) return [];
    // 每条条目只会命中一次（card_id / map_id 各判一次），不必去重
    return entries
      .filter((e) => (cardId ? e.card_id === cardId : false) || (mapId ? e.map_id === mapId : false))
      .sort((a, b) => a.start_t - b.start_t)
      .slice(0, MAX_ITEMS);
  }, [entries, cardId, mapId]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card/60 p-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <CalendarClock className="size-3" />
        关联事件{scopeNote ? '（本地图）' : ''} · {items.length}
      </div>
      <ul className="space-y-0.5">
        {items.map((entry) => (
          <li key={entry.id} className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="truncate">{entry.title || '（未命名事件）'}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {spanOf(entry, unit)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
