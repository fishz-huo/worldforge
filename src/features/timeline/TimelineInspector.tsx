/**
 * 时间轴检查器
 * ------------------------------------------------------------------
 * 选中条目 → 编辑条目（EntryEditor）；
 * 未选中   → 展示游标时刻的世界观切片（MomentPanel）。
 */
import { InspectorPanel } from '@/components/layout/Panel';
import { useStore } from '@/store';
import { EntryEditor } from './EntryEditor';
import { MomentPanel } from './MomentPanel';

export function TimelineInspector({ cursor }: { cursor: number | null }) {
  const entry = useStore((s) => s.entries.find((e) => e.id === s.selectedEntryId));
  return (
    <InspectorPanel title={entry ? '时间轴条目' : '时刻快照'}>
      {entry ? <EntryEditor entryId={entry.id} /> : <MomentPanel cursor={cursor} />}
    </InspectorPanel>
  );
}
