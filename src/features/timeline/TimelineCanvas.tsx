/**
 * 时间轴画布
 * ==================================================================
 * 布局：**一个**横向滚动容器，泳道名称列用 `position: sticky; left: 0`
 * 钉在最左边，刻度尺是滚动内容的第一个子元素。
 *
 *   ┌────────┬──────────────────────────────────────────┐
 *   │ (空)   │ 0 年   50 年   100 年   150 年 …          │ ← 刻度尺（随内容横向滚）
 *   ├────────┼──────────────────────────────────────────┤
 *   │ 事件 👁 │    ◆        ▓▓▓▓▓▓▓        ◆             │ ← 泳道
 *   └────────┴──────────────────────────────────────────┘
 *    sticky    内容总宽 = 跨度 × 比例尺（浏览器原生横向滚动条）
 *
 * 为什么是"一个滚动容器"（v0.2.1）：之前名称列在容器**外面**、刻度尺在
 * 容器**里面**却自己留了一段左边距 —— 同一个坐标系写了两遍，于是刻度、
 * 条目、游标各差一点，用户看到的就是"对不齐"。现在三者共用 `toX(t)`。
 *
 * 指针事件：拖条目会离开那个小元素，靠容器兜住 pointermove / pointerup；
 * 点泳道空白则是"选时刻"（useCursorScrub），两者互不干扰。
 */
import type { Card, Era, TimelineEntry, Track } from '@/types';
import { entrySpan } from '@/types';
import { useEntryDrag } from './useEntryDrag';
import { useCursorScrub } from './useCursorScrub';
import { useCtrlWheelZoom } from './useCtrlWheelZoom';
import { TimelineAxis } from './TimelineAxis';
import { TimelineLaneRow } from './TimelineLaneRow';
import { niceStep, type TimeRange } from './scale';
import { LABEL_COL, LABEL_COL_NARROW, isNarrow } from './useTimelineView';

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
  /** 点时间轴空白处：清掉选中的条目（否则检查器一直停在编辑器上） */
  onClearEntrySelection: () => void;
  onSelectTrack: (id: string) => void;
  onToggleTrackHidden: (track: Track) => void;
  onCommitEntry: (id: string, patch: { start_t: number; end_t: number | null }) => void;
  onEraChange: (id: string, patch: { start_t?: number; end_t?: number }) => void;
  /** Ctrl + 滚轮缩放：anchorPx 是锚点在视口内的像素位置 */
  onZoomAt: (factor: number, anchorPx: number) => void;
}

export function TimelineCanvas({
  tracks, entries, cards, eras, range, pxPerUnit, width, viewportPx, scrollLeft, unit,
  cursor, selectedTrackId, selectedEntryId, scrollRef, onScroll, onCursorChange,
  onSelectEntry, onClearEntrySelection, onSelectTrack, onToggleTrackHidden, onCommitEntry, onEraChange, onZoomAt,
}: Props) {
  const toX = (t: number) => (t - range.min) * pxPerUnit;
  const getScroller = () => scrollRef.current;

  /**
   * 能画图的那一段宽度 = 内容总宽 − 名称列宽度。刻度序列、可见范围、
   * 底部步长与每条泳道的宽度都用它。泳道**不能**用 flex-1 自己撑：
   * 那样宽度由内容框决定，一旦比比例尺算出来的小，泳道就比刻度尺短一截 ——
   * 条目与游标看着对，点下去却换算成另一个刻度。
   */
  const gutter = isNarrow() ? LABEL_COL_NARROW : LABEL_COL;
  const plotPx = Math.max(80, width - gutter);

  /**
   * 内容坐标 → **泳道内**坐标。泳道摆在名称列右边，而泳道里的绝对定位
   * 以泳道自身为基准，所以必须扣掉 gutter；刻度尺从内容左端开始，不扣。
   * 两边最终落在屏幕上的位置因此完全一致 —— 这就是"对齐"的全部秘密。
   */
  const toLaneX = (t: number) => toX(t) - gutter;

  const drag = useEntryDrag({ range, pxPerUnit, viewportPx, getScroller, onCommit: onCommitEntry });
  const scrub = useCursorScrub({ range, pxPerUnit, getScroller, onMove: onCursorChange });

  /**
   * 点泳道空白：先取消条目选中，再把游标放到这一刻。只清游标是不够的 ——
   * 检查器会一直停在条目编辑器上，用户就再也看不到「时刻快照」了。
   */
  const onLanePointerDown = (e: React.PointerEvent) => {
    onClearEntrySelection();
    scrub.scrub(e);
  };

  /** Ctrl / Cmd + 滚轮缩放（以指针为锚点）；普通滚轮留给原生横向滚动。 */
  useCtrlWheelZoom(scrollRef, onZoomAt);

  /**
   * 点击泳道名称 → 把该泳道第一个条目滚到视口中央。
   * 名称列压住了容器左侧，所以可用宽度要扣掉它，否则条目的中点会被压住
   * （"点了却看不到"）。
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
    const x = toX((from + to) / 2);
    el.scrollTo({ left: Math.max(0, x - (el.clientWidth - gutter) / 2), behavior: 'smooth' });
  };

  /** 可见刻度步长（拖动吸附与底部提示共用），用"能画图的那一段"算 */
  const step = niceStep(plotPx / pxPerUnit, Math.max(1, Math.floor(plotPx / 90)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onPointerMove={(e) => {
          drag.move(e);
          scrub.move(e);
        }}
        onPointerUp={() => {
          drag.end();
          scrub.end();
        }}
        onPointerCancel={() => {
          drag.cancel();
          scrub.end();
        }}
        className="min-h-0 flex-1 overflow-auto overscroll-contain"
      >
        <div style={{ width }} className="relative">
          {/* 刻度尺：滚动内容的第一个子元素，与泳道同一个坐标系 */}
          <TimelineAxis
            range={range}
            pxPerUnit={pxPerUnit}
            viewportPx={plotPx}
            scrollLeft={scrollLeft}
            eras={eras}
            unit={unit}
            cursor={cursor}
            onCursorChange={onCursorChange}
            onEraChange={onEraChange}
          />

          {tracks.map((track) => {
            const mine = entries.filter((e) => e.track_id === track.id);
            return (
              <TimelineLaneRow
                key={track.id}
                track={track}
                entries={mine}
                cards={cards}
                cursor={cursor}
                selectedEntryId={selectedEntryId}
                active={selectedTrackId === track.id}
                preview={drag.preview}
                gutter={gutter}
                plotPx={plotPx}
                toX={toLaneX}
                pxPerUnit={pxPerUnit}
                onFocusTrack={() => focusTrack(track.id)}
                onToggleHidden={() => onToggleTrackHidden(track)}
                onSelectEntry={onSelectEntry}
                onBeginDrag={drag.begin}
                onPointerDown={onLanePointerDown}
              />
            );
          })}

          {tracks.length === 0 && (
            <div className="sticky left-0 px-4 py-10 text-center text-xs text-muted-foreground">
              还没有泳道。点上方工具条的「泳道与纪元」新建事件 / 角色生命线 / 地理变化等轨道。
            </div>
          )}
        </div>
      </div>

      {/* 底部：目前可见的刻度步长（拖动吸附时会用到，顺便也是缩放级别的反馈） */}
      <div className="shrink-0 border-t border-border px-2 py-0.5 text-[10px] text-muted-foreground">
        刻度步长 {step} {unit}
        <span className="ml-2">· 点空白处定位游标，拖条目平移，拖两端改起止，按住 Shift 吸附</span>
        <span className="ml-2">· Ctrl + 滚轮缩放，滚轮横向滚动</span>
      </div>
    </div>
  );
}
