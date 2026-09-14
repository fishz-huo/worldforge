/**
 * 时间轴的一行：泳道名称 + 内容
 * ------------------------------------------------------------------
 * 从 TimelineCanvas 拆出来：那个文件要塞下"刻度尺 + 泳道 + 底部提示"三块，
 * 加上解释坐标系的注释就顶到 200 行上限了。
 *
 * 两条纪律：
 *   - 名称列宽度用 `gutter`（与刻度尺的 sticky 偏移同一个值），不能各算各的；
 *   - 内容区宽度写死成 `plotPx`（内容总宽 − 名称列）。用 flex-1 的话宽度由
 *     内容框决定，一旦比比例尺算出来的小，泳道就比刻度尺短一截 ——
 *     条目与游标看着对，点下去却换算成另一个刻度。
 */
import type { Card, TimelineEntry, Track } from '@/types';
import { cn } from '@/lib/utils';
import { TimelineLane } from './TimelineLane';
import { TimelineLaneLabel } from './TimelineLaneLabel';
import type { DragPreview } from './useEntryDrag';

interface Props {
  track: Track;
  entries: TimelineEntry[];
  cards: Card[];
  cursor: number | null;
  selectedEntryId: string | null;
  active: boolean;
  preview: DragPreview | null;
  /** 名称列宽度（同时是刻度尺的 sticky 偏移） */
  gutter: number;
  /** 内容区宽度 = 内容总宽 − 名称列 */
  plotPx: number;
  /** 刻度 → 泳道内像素（调用方已扣掉名称列） */
  toX: (t: number) => number;
  pxPerUnit: number;
  onFocusTrack: () => void;
  onToggleHidden: () => void;
  onSelectEntry: (id: string) => void;
  onBeginDrag: (e: React.PointerEvent, entry: TimelineEntry, mode: 'move' | 'start' | 'end') => void;
  /** 点空白：取消条目选中 + 把游标放到这一刻 */
  onPointerDown: (e: React.PointerEvent) => void;
}

export function TimelineLaneRow({
  track, entries, cards, cursor, selectedEntryId, active, preview, gutter, plotPx,
  toX, pxPerUnit, onFocusTrack, onToggleHidden, onSelectEntry, onBeginDrag, onPointerDown,
}: Props) {
  const hidden = track.hidden === 1;

  return (
    <div className="flex items-stretch">
      <TimelineLaneLabel
        track={track}
        entries={entries}
        cards={cards}
        cursor={cursor}
        active={active}
        width={gutter}
        onClick={onFocusTrack}
        onToggleHidden={onToggleHidden}
      />
      <div
        style={{ width: plotPx }}
        className={cn('relative', hidden && 'opacity-25')}
        onPointerDown={onPointerDown}
        title={hidden ? '这条泳道已隐藏' : '点击空白处把游标放到这一刻（同时取消条目选中）'}
      >
        <TimelineLane
          track={track}
          entries={hidden ? [] : entries}
          toX={toX}
          pxPerUnit={pxPerUnit}
          cursor={cursor}
          selectedEntryId={selectedEntryId}
          preview={preview}
          onSelectEntry={onSelectEntry}
          onBeginDrag={onBeginDrag}
        />
      </div>
    </div>
  );
}
