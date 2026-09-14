/**
 * 时间轴检查器
 * ------------------------------------------------------------------
 * 选中条目 → 编辑条目（EntryEditor）；
 * 未选中   → 展示游标时刻的世界观切片（MomentPanel）。
 *
 * 除了表单，这里还给一个「定位到这一刻」：把游标所在时刻滚到视口中央。
 * 时间轴变长之后，面板上看到的刻度与屏幕上的位置经常对不上，
 * 有一个一键对齐的按钮会省掉很多来回拖。
 */
import { LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InspectorPanel } from '@/components/layout/Panel';
import { useStore } from '@/store';
import { EntryEditor } from './EntryEditor';
import { MomentPanel } from './MomentPanel';

interface Props {
  cursor: number | null;
  /** 把某个刻度滚到视口中央 */
  onCenter: (t: number) => void;
}

export function TimelineInspector({ cursor, onCenter }: Props) {
  const entry = useStore((s) => s.entries.find((e) => e.id === s.selectedEntryId));
  const selected = entry
    ? { id: entry.id, start_t: entry.start_t }
    : cursor !== null
      ? { id: 'cursor', start_t: cursor }
      : null;

  return (
    <InspectorPanel
      title={entry ? '时间轴条目' : '时刻快照'}
      actions={
        selected ? (
          <Button
            variant="ghost"
            size="icon-sm"
            title="把这一刻滚到视口中央"
            onClick={() => onCenter(selected.start_t)}
          >
            <LocateFixed />
          </Button>
        ) : undefined
      }
    >
      {entry ? <EntryEditor entryId={entry.id} /> : <MomentPanel cursor={cursor} />}
    </InspectorPanel>
  );
}
