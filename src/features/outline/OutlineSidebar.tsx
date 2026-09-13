/**
 * 大纲侧栏
 * ------------------------------------------------------------------
 * 大纲文稿列表 + 文本/树的同步动作 + 状态图例。
 */
import { ArrowLeftRight, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { SidePanel } from '@/components/layout/Panel';
import { OUTLINE_STATUS } from '@/types';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { askConfirm } from '@/lib/confirm';

export function OutlineSidebar({ progress }: { progress: { done: number; total: number; percent: number } }) {
  const docs = useStore((s) => s.docs);
  const selectedOutlineId = useStore((s) => s.selectedOutlineId);
  const selectOutline = useStore((s) => s.selectOutline);
  const createDoc = useStore((s) => s.createDoc);
  const deleteDoc = useStore((s) => s.deleteDoc);
  const outlineFromText = useStore((s) => s.outlineFromText);
  const textFromOutline = useStore((s) => s.textFromOutline);

  const list = docs.filter((d) => d.kind === 'outline');
  const current = list.find((d) => d.id === selectedOutlineId);

  return (
    <SidePanel
      title="故事大纲"
      actions={
        <Button variant="ghost" size="icon-sm" title="新建大纲" onClick={() => createDoc('outline', '新大纲')}>
          <Plus />
        </Button>
      }
    >
      <div className="space-y-2 p-2">
        <div className="space-y-0.5">
          {list.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                'group flex items-center gap-1 rounded px-2 py-1.5 text-xs transition-colors',
                doc.id === selectedOutlineId ? 'bg-primary/15 text-primary' : 'hover:bg-accent',
              )}
            >
              <button onClick={() => selectOutline(doc.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                <FileText className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{doc.title}</span>
              </button>
              <button
                onClick={async () => {
                  if (await askConfirm(`删除大纲「${doc.title}」？`)) deleteDoc(doc.id);
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div className="px-1 py-2 text-[11px] text-muted-foreground">还没有大纲，点右上角 + 新建。</div>
          )}
        </div>

        {current && (
          <>
            <SectionTitle>完成度</SectionTitle>
            <div className="px-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {progress.done} / {progress.total} 已完成（{progress.percent}%）
              </div>
            </div>

            <SectionTitle>文本 ⇄ 树形</SectionTitle>
            <div className="space-y-1 px-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-1.5 text-[11px]"
                onClick={() => outlineFromText(current.id)}
              >
                <ArrowLeftRight className="size-3" /> 用文本标题重建大纲树
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-1.5 text-[11px]"
                onClick={() => textFromOutline(current.id)}
              >
                <ArrowLeftRight className="size-3" /> 把大纲树写回文本
              </Button>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                两种视图共用同一份文稿：文本里的 # 层级就是树的层级。重建时会按标题保留已有的状态与卡片挂接。
              </p>
            </div>

            <SectionTitle>状态图例</SectionTitle>
            <div className="space-y-0.5 px-1">
              {OUTLINE_STATUS.map((s) => (
                <div key={s.status} className="flex items-center gap-1.5 text-[11px]">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </SidePanel>
  );
}
