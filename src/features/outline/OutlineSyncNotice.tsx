/**
 * 大纲「文本与树不同步」引导条
 * ------------------------------------------------------------------
 * 只在两边都有落空时出现（见 outlineProjection 的 needsGuide）：
 * 升级老库、或导入别人的世界观备份时，常常是文本里只有 3 个标题、
 * 库里却有 12 个节点 —— 这时要告诉用户，并且两个出口都不删数据。
 */
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjectionStats } from './outlineProjection';

export function OutlineSyncNotice({ stats, onWriteTree, onUseText }: {
  stats: ProjectionStats;
  /** 把库里的树写进文本（不带 ✅/❌ 徽章，不删任何行） */
  onWriteTree: () => void;
  /** 以文本为准：什么都不写，孤立行留在库里等以后关联 */
  onUseText: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-300/70 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        这篇大纲的文本与树不同步：库里 {stats.rows} 个节点，只有 {stats.matched} 个能在文本里找到。
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={onWriteTree}>
          把树写进文本
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onUseText}>
          以文本为准（旧节点保留）
        </Button>
      </div>
    </div>
  );
}
