/**
 * 时间轴模块
 * ------------------------------------------------------------------
 * 需求 3：可视化时间轴，并与卡片、地图联动。
 * 视图状态（可见区间 viewport、游标 cursor）在这里集中管理，
 * 便于「缩放 / 平移 / 适配全部条目 / 定位到某条目」这些操作互相配合。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { entryRange } from '@/lib/query';
import type { Viewport } from '@/types';
import { DEFAULT_TIME_CONFIG } from '@/types';
import { clamp } from '@/lib/utils';
import { useStore } from '@/store';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineInspector } from './TimelineInspector';
import { TimelineSidebar } from './TimelineSidebar';

export function TimelineModule() {
  const tracks = useStore((s) => s.tracks);
  const entries = useStore((s) => s.entries);
  const eras = useStore((s) => s.eras);
  const cards = useStore((s) => s.cards);
  const selectedEntryId = useStore((s) => s.selectedEntryId);
  const selectEntry = useStore((s) => s.selectEntry);
  const timeConfig = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId)?.meta?.time);

  const unit = timeConfig?.unit ?? DEFAULT_TIME_CONFIG.unit;
  const [viewport, setViewport] = useState<Viewport>({
    start: timeConfig?.defaultStart ?? 0,
    end: timeConfig?.defaultEnd ?? 1000,
  });
  const [cursor, setCursor] = useState<number | null>(null);

  /** 全部条目的刻度范围 */
  const fullRange = useMemo(() => entryRange(entries), [entries]);

  /** 适配全部条目（留 8% 边距） */
  const fit = useCallback(() => {
    const [min, max] = fullRange;
    const pad = (max - min) * 0.08 || 1;
    setViewport({ start: min - pad, end: max + pad });
  }, [fullRange]);

  // 切换世界观时重新适配
  useEffect(() => {
    fit();
    setCursor(null);
  }, [fit]);

  /** 缩放：以游标（或视图中心）为锚点 */
  const zoom = (factor: number) => {
    setViewport((v) => {
      const span = v.end - v.start;
      const anchor = cursor ?? (v.start + v.end) / 2;
      const next = clamp(span * factor, 0.05, 1e7);
      const ratio = (anchor - v.start) / span;
      return { start: anchor - next * ratio, end: anchor + next * (1 - ratio) };
    });
  };

  const pan = (delta: number) => setViewport((v) => ({ start: v.start + delta, end: v.end + delta }));

  return (
    <ModuleLayout>
      <TimelineSidebar onFit={fit} />

      <ModuleBody>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">
            可见区间 {Math.round(viewport.start * 10) / 10} → {Math.round(viewport.end * 10) / 10} {unit}
          </span>
          <span className="text-muted-foreground">· 条目 {entries.length}</span>
          {cursor !== null && (
            <span className="text-primary">
              · 游标 {Math.round(cursor * 100) / 100} {unit}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Hint label="放大">
              <Button variant="ghost" size="icon-sm" onClick={() => zoom(0.7)}>
                <Plus />
              </Button>
            </Hint>
            <Hint label="缩小">
              <Button variant="ghost" size="icon-sm" onClick={() => zoom(1.4)}>
                <Minus />
              </Button>
            </Hint>
            <Hint label="适配全部条目">
              <Button variant="ghost" size="icon-sm" onClick={fit}>
                <Maximize2 />
              </Button>
            </Hint>
            <Button variant="ghost" size="sm" onClick={() => setCursor(null)} disabled={cursor === null}>
              清除游标
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <TimelineCanvas
            tracks={tracks}
            entries={entries}
            cards={cards}
            eras={eras}
            viewport={viewport}
            unit={unit}
            cursor={cursor}
            selectedEntryId={selectedEntryId}
            onCursorChange={setCursor}
            onSelectEntry={(id) => selectEntry(id)}
            onPan={pan}
          />
        </div>
      </ModuleBody>

      <TimelineInspector cursor={cursor} />
    </ModuleLayout>
  );
}
