/**
 * 大纲顶部栏：大纲名 + 四个页签
 * ------------------------------------------------------------------
 * 从 OutlineModule 抽出来的（那个文件已接近 200 行红线）。
 * 纯文本 / 树形 / 思维导图 / 分栏，默认视图＝纯文本 ——
 * 结构以文本为唯一真相源，先看文本最自然，其余三种都是它的投影。
 * 标题用 AutoInput：失焦即落库，与卡片详情页的写法一致。
 */
import { Columns2, ListTree, Network, Pencil, type LucideIcon } from 'lucide-react';
import { AutoInput } from '@/components/common/AutoField';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type OutlineView = 'text' | 'tree' | 'map' | 'split';

const VIEWS: { value: OutlineView; label: string; icon: LucideIcon }[] = [
  { value: 'text', label: '纯文本', icon: Pencil },
  { value: 'tree', label: '树形', icon: ListTree },
  { value: 'map', label: '思维导图', icon: Network },
  { value: 'split', label: '分栏', icon: Columns2 },
];

export function OutlineTabs({
  title,
  onTitleCommit,
  view,
  onViewChange,
}: {
  title: string;
  onTitleCommit: (next: string) => void;
  view: OutlineView;
  onViewChange: (next: OutlineView) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
      <AutoInput
        value={title}
        onCommit={onTitleCommit}
        className="h-7 max-w-[14rem] border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
      />
      <Tabs value={view} onValueChange={(next) => onViewChange(next as OutlineView)} className="ml-auto">
        <TabsList>
          {VIEWS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1">
              <Icon className="size-3" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
