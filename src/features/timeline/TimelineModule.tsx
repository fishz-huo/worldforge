/**
 * 时间轴模块
 * ==================================================================
 * 布局（v0.2 起改为横向排布）：
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ 缩放 − + / 适配全部   可见区间 · 条目数 · 游标   ⊞ 泳道   │ ← 工具条
 *   ├──────┬───────────────────────────────────────────────────┤
 *   │ 事件 │▏  120    240    360    480    600    720    840    │ ← 刻度尺（横向跟滚）
 *   │ 角色 │    ▓▓▓▓▓▓▓▓▓▓▓        ◆          ▓▓▓▓▓▓▓           │
 *   │ 地理 │         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ▓▓▓▓▓▓▓▓          │
 *   └──────┴───────────────────────────────────────────────────┘
 *            144px        时间轴本体（可横向滚动）
 *
 * 为什么把左侧栏收进工具条：时间轴是**横向**信息，而原来的三栏布局
 * （256px 侧栏 + 内容 + 320px 检查器）都是竖向的，1024 宽的窗口里
 * 时间轴本体只剩 448px —— 方向完全冲突。泳道与纪元管理改放下拉浮层，
 * 检查器改为可收起的抽屉，时间轴本体拿到几乎全部宽度。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListTree, Maximize2, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import type { Era } from '@/types';
import { DEFAULT_TIME_CONFIG } from '@/types';
import { useStore } from '@/store';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineInspector } from './TimelineInspector';
import { TimelineManagePopover } from './TimelineManagePopover';
import { fullRangeOf } from './scale';
import { useTimelineView } from './useTimelineView';

export function TimelineModule() {
  const tracks = useStore((s) => s.tracks);
  const entries = useStore((s) => s.entries);
  const eras = useStore((s) => s.eras);
  const cards = useStore((s) => s.cards);
  const selectedEntryId = useStore((s) => s.selectedEntryId);
  const selectEntry = useStore((s) => s.selectEntry);
  const updateEntry = useStore((s) => s.updateEntry);
  const updateEra = useStore((s) => s.updateEra);
  const timeConfig = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId)?.meta?.time);
  const unit = timeConfig?.unit ?? DEFAULT_TIME_CONFIG.unit;

  const [cursor, setCursor] = useState<number | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [showInspector, setShowInspector] = useState(true);

  /** 全部内容的时间范围（条目 + 纪元） */
  const fullRange = useMemo(() => fullRangeOf(entries, eras), [entries, eras]);
  const view = useTimelineView(fullRange);

  // 切换世界观 / 条目范围变化时把游标清掉，避免指着一个不存在的时刻
  useEffect(() => {
    setCursor(null);
  }, [fullRange.min, fullRange.max]);

  /** 拖游标：不进 store（它是视图状态），只改本地 state */
  const handleCursor = useCallback((t: number) => {
    if (!Number.isFinite(t)) return;
    setCursor(Math.round(t * 1000) / 1000);
  }, []);

  const visibleFrom = cursor === null ? null : Math.round(cursor * 100) / 100;

  return (
    <ModuleLayout>
      <ModuleBody>
        <div className="flex h-full min-h-0 flex-col">
          {/* ---------------------------- 工具条 ---------------------------- */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
            <span className="flex items-center gap-0.5">
              <Hint label="缩小（Ctrl + 滚轮也可以）">
                <Button variant="ghost" size="icon-sm" onClick={() => view.zoomAt(0.8)}>
                  <Minus />
                </Button>
              </Hint>
              <Hint label="放大（Ctrl + 滚轮也可以）">
                <Button variant="ghost" size="icon-sm" onClick={() => view.zoomAt(1.25)}>
                  <Plus />
                </Button>
              </Hint>
              <Hint label="适配全部条目">
                <Button variant="ghost" size="icon-sm" onClick={view.fit}>
                  <Maximize2 />
                </Button>
              </Hint>
            </span>

            <span className="text-muted-foreground">
              全程 {Math.round(fullRange.min * 10) / 10} → {Math.round(fullRange.max * 10) / 10} {unit}
              · 条目 {entries.length}
            </span>
            {visibleFrom !== null && (
              <span className="text-primary">· 游标 {visibleFrom} {unit}</span>
            )}

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                disabled={cursor === null}
                onClick={() => setCursor(null)}
              >
                清除游标
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setManageOpen(true)}>
                <SlidersHorizontal className="size-3.5" /> 泳道与纪元
              </Button>
              <Hint label={showInspector ? '收起条目面板' : '展开条目面板'}>
                <Button
                  variant={showInspector ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setShowInspector((v) => !v)}
                >
                  <ListTree />
                </Button>
              </Hint>
            </div>
          </div>

          {/* ---------------------------- 时间轴 ---------------------------- */}
          <TimelineCanvas
            tracks={tracks}
            entries={entries}
            cards={cards}
            eras={eras}
            range={view.range}
            pxPerUnit={view.pxPerUnit}
            width={view.width}
            viewportPx={view.viewportPx}
            scrollLeft={view.scrollLeft}
            unit={unit}
            cursor={cursor}
            selectedTrackId={selectedTrackId}
            selectedEntryId={selectedEntryId}
            scrollRef={view.scrollRef}
            onScroll={view.onScroll}
            onCursorChange={handleCursor}
            onSelectEntry={(id) => selectEntry(id)}
            onSelectTrack={setSelectedTrackId}
            onCommitEntry={(id, patch) => updateEntry(id, patch)}
            onEraChange={(id, patch) => updateEra(id, patch as Partial<Era>)}
            onZoomAt={view.zoomAt}
          />
        </div>
      </ModuleBody>

      {/* 条目详情：可收起的右侧抽屉（默认展开，但不再固定占 320px） */}
      {showInspector && <TimelineInspector cursor={cursor} onCenter={view.centerOn} />}

      <TimelineManagePopover open={manageOpen} onOpenChange={setManageOpen} onFit={view.fit} />
    </ModuleLayout>
  );
}
