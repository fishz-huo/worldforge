/**
 * 多选面板（框选到 ≥2 个对象时检查器里的内容）
 * ==================================================================
 * 用户 2026-09-25 的需求：框选之后检查器显示「已选中 N 个对象」并能**批量删除**。
 * 单对象仍然是原来那套编辑器（PinEditor / RegionEditor / TerrainEditor），
 * 这里只管"一下子选中好几个"：报总数与构成、列出名字、给删除入口。
 *
 * 列表里点一行 ＝ 单选它（于是检查器切成那个对象的编辑器，框选结果自然收窄）；
 * 删除按钮与 Delete 键走**同一段逻辑**（useMapDelete 的 request），
 * 所以"1 个直接删、多个先确认"的口径不会两处走岔。
 */
import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { useStore } from '@/store';
import { selectionCounts, selectionKey } from './mapSelection';
import type { MapSelectionItem, MapSelectionKind } from './mapSelection';
import type { MapSelection } from './useMapSelection';

const KIND_LABEL: Record<MapSelectionKind, string> = { pin: '标记', region: '区域', terrain: '地形' };

/** 一行：一个被选中的对象（名字取自它自己的记录） */
interface Row {
  key: string;
  item: MapSelectionItem;
  name: string;
}

export function MapSelectionPanel({
  selection,
  onDelete,
}: {
  selection: MapSelection;
  onDelete: () => void;
}) {
  // ⚠️ selector 只取原始引用，派生（find/map）一律 useMemo：返回新数组会让 zustand 无限重渲染
  const pins = useStore((s) => s.pins);
  const regions = useStore((s) => s.regions);
  const items = selection.items;
  const counts = selectionCounts(items);

  const rows = useMemo<Row[]>(
    () => items.map((item) => ({
      key: selectionKey(item),
      item,
      name: item.kind === 'region'
        ? regions.find((r) => r.id === item.id)?.name ?? '（已不存在）'
        : pins.find((p) => p.id === item.id)?.label ?? '（已不存在）',
    })),
    [items, pins, regions],
  );

  /** 点一行 = 只选中它（三种对象各走自己的入口，语义与画布上点选一致） */
  const focus = (item: MapSelectionItem) => {
    if (item.kind === 'region') selection.selectRegion(item.id);
    else if (item.kind === 'terrain') selection.selectTerrain(item.id);
    else selection.selectPin(item.id);
  };

  return (
    <div className="space-y-3 p-2">
      {/* 标题（已选中 N 个对象）在检查器的标题栏上，这里接着报构成 */}
      <div className="rounded-md border border-border bg-card/50 p-2 text-[11px] text-muted-foreground">
        {KIND_LABEL.pin} {counts.pin} · {KIND_LABEL.region} {counts.region} · {KIND_LABEL.terrain} {counts.terrain}
      </div>

      <SectionTitle right={<span className="text-[10px] font-normal">点一行＝只选中它</span>}>
        对象清单
      </SectionTitle>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => focus(row.item)}
              className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-left text-xs hover:bg-accent"
            >
              <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                {KIND_LABEL[row.item.kind]}
              </span>
              <span className="truncate">{row.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={onDelete}>
        <Trash2 className="size-3.5" /> 删除这 {counts.total} 个对象
      </Button>
    </div>
  );
}
