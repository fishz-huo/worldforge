/**
 * 时间轴画布
 * ==================================================================
 * 布局：左边一列固定的泳道名称，右边是**一个真正的横向滚动容器**，
 * 里面按「跨度 × 比例尺」定宽地摆放刻度尺与所有泳道。
 *
 * 这就是「放大后拖滚动条能看完整条时间轴」的实现方式：
 * 内容有真实宽度，浏览器原生滚动条自然出现，不需要自己写平移逻辑。
 * （旧实现按百分比定位，内容永远铺满容器宽，横向没有任何可滚动的像素。）
 *
 * 指针事件统一挂在这里：拖动条目时指针会离开那个小元素，
 * 靠容器兜住 pointermove / pointerup 才不会丢事件。
 */
import { useEffect, useMemo } from 'react';
import type { Card, Era, TimelineEntry, Track } from '@/types';
import { entrySpan } from '@/types';
import { useEntryDrag } from './useEntryDrag';
import { TimelineAxis } from './TimelineAxis';
import { TimelineLane } from './TimelineLane';
import { TimelineLaneLabel } from './TimelineLaneLabel';
import { niceStep, type TimeRange } from './scale';

interface Props {
  tracks: Track[];
  entries: TimelineEntry[];
  cards: Card[];
  eras: Era[];
  range: TimeRange;
  pxPerUnit: number;
  width: number;
  viewportPx: number;
  scrollLeft: number;
  unit: string;
  cursor: number | null;
  selectedTrackId: string | null;
  selectedEntryId: string | null;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onCursorChange: (t: number) => void;
  onSelectEntry: (id: string) => void;
  onSelectTrack: (id: string) => void;
  onCommitEntry: (id: string, patch: { start_t: number; end_t: number | null }) => void;
  onEraChange: (id: string, patch: { start_t?: number; end_t?: number }) => void;
  /** Ctrl + 滚轮缩放：anchorPx 是锚点在视口内的像素位置 */
  onZoomAt: (factor: number, anchorPx: number) => void;
}

export function TimelineCanvas({
  tracks, entries, cards, eras, range, pxPerUnit, width, viewportPx, scrollLeft, unit,
  cursor, selectedTrackId, selectedEntryId, scrollRef, onScroll, onCursorChange,
  onSelectEntry, onSelectTrack, onCommitEntry, onEraChange, onZoomAt,
}: Props) {
  const visibleTracks = useMemo(() => tracks.filter((t) => t.hidden !== 1), [tracks]);

  const drag = useEntryDrag({
    range,
    pxPerUnit,
    viewportPx,
    getScroller: () => scrollRef.current,
    onCommit: onCommitEntry,
  });

  /** Ctrl / Cmd + 滚轮缩放（以指针为锚点）；普通滚轮留给原生横向滚动 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      onZoomAt(e.deltaY > 0 ? 0.8 : 1.25, e.clientX - rect.left);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollRef, onZoomAt]);

  /**
   * 点击泳道名称 → 把该泳道第一个条目滚到视口中央。
   * 与「左侧固定名称列 + 右侧滚动内容」这套布局配合，用户不必横向找。
   */
  const focusTrack = (trackId: string) => {
    onSelectTrack(trackId);
    const el = scrollRef.current;
    if (!el) return;
    const first = entries
      .filter((e) => e.track_id === trackId)
      .sort((a, b) => a.start_t - b.start_t)[0];
    if (!first) return;
    const [from, to] = entrySpan(first, 8 / pxPerUnit);
    const x = ((from + to) / 2 - range.min) * pxPerUnit;
    el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: 'smooth' });
  };

  const laneHeight = (t: Track) => (t.valued ? 56 : 40);
  void laneHeight;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        纵向滚动放在**最外层**：左列（泳道名称）与右侧滚动区一起滚，
        否则两边的竖向偏移会各自独立，泳道名和内容会错位。
        横向滚动只发生在右列，左列因此天然"钉住"。
      */}
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {/* 左列：泳道名称（不随横向滚动移动） */}
        <div className="sticky left-0 z-30 w-36 shrink-0 self-start border-r border-border">
          <div className="sticky top-0 z-10 h-12 border-b border-border bg-card/60" />
          {visibleTracks.map((track) => (
            <TimelineLaneLabel
              key={track.id}
              track={track}
              entries={entries.filter((e) => e.track_id === track.id)}
              cards={cards}
              cursor={cursor}
              active={selectedTrackId === track.id}
              onClick={() => focusTrack(track.id)}
            />
          ))}
        </div>

        {/* 右列：横向滚动容器（刻度尺与泳道在同一个滚动内容里，天然对齐） */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          onPointerMove={drag.move}
          onPointerUp={() => drag.end()}
          onPointerCancel={drag.cancel}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
        >
          <div style={{ width }} className="relative">
            <div className="sticky top-0 z-20 bg-background">
              <TimelineAxis
                range={range}
                pxPerUnit={pxPerUnit}
                viewportPx={viewportPx}
                scrollLeft={scrollLeft}
                eras={eras}
                unit={unit}
                cursor={cursor}
                onCursorChange={onCursorChange}
                onEraChange={onEraChange}
                onScrollBy={(dx) => {
                  const el = scrollRef.current;
                  if (el) el.scrollLeft += dx;
                }}
              />
            </div>

            {/* 纪元背景竖带（贯穿所有泳道） */}
            <div className="pointer-events-none absolute inset-0 z-0">
              {eras.map((era) => {
                const left = (era.start_t - range.min) * pxPerUnit;
                const w = Math.max(2, (era.end_t - era.start_t) * pxPerUnit);
                return (
                  <div
                    key={era.id}
                    className="absolute bottom-0 top-12 opacity-[0.07]"
                    style={{ left, width: w, background: era.color }}
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
                  toX={(t) => (t - range.min) * pxPerUnit}
                  pxPerUnit={pxPerUnit}
                  cursor={cursor}
                  selectedEntryId={selectedEntryId}
                  preview={drag.preview}
                  onSelectEntry={onSelectEntry}
                  onBeginDrag={drag.begin}
                />
              ))}
              {visibleTracks.length === 0 && (
                <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                  还没有可见的泳道。点上方工具条的「泳道」新建事件 / 角色生命线 / 地理变化等轨道。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部：目前可见的刻度步长（拖动吸附时会用到，顺便也是缩放级别的反馈） */}
      <div className="shrink-0 border-t border-border px-2 py-0.5 text-[10px] text-muted-foreground">
        刻度步长 {niceStep(viewportPx / pxPerUnit, Math.max(1, Math.floor(viewportPx / 90)))} {unit}
        <span className="ml-2">· 拖动条目平移，拖两端改起止，按住 Shift 吸附到刻度</span>
        <span className="ml-2">· Ctrl + 滚轮缩放，普通滚轮横向滚动</span>
      </div>
    </div>
  );
}
