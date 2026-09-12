/**
 * 写作层侧栏
 * ------------------------------------------------------------------
 * 文稿列表：正文 / 大纲 / 笔记分组，支持新建、重命名、删除。
 */
import { useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionTitle } from '@/components/ui/primitives';
import { SidePanel } from '@/components/layout/Panel';
import { countWords } from '@/lib/markdown';
import type { DocKind } from '@/types';
import { DOC_KINDS } from '@/types';
import { cn, relativeTime } from '@/lib/utils';
import { useStore } from '@/store';

export function WriterSidebar() {
  const docs = useStore((s) => s.docs);
  const selectedDocId = useStore((s) => s.selectedDocId);
  const selectDoc = useStore((s) => s.selectDoc);
  const createDoc = useStore((s) => s.createDoc);
  const updateDoc = useStore((s) => s.updateDoc);
  const deleteDoc = useStore((s) => s.deleteDoc);
  const setModule = useStore((s) => s.setModule);
  const [kind, setKind] = useState<DocKind>('manuscript');

  const list = docs.filter((d) => d.kind === kind);

  return (
    <SidePanel
      title="文稿"
      actions={
        <Button
          variant="ghost"
          size="icon-sm"
          title="新建文稿"
          onClick={() => createDoc(kind, kind === 'note' ? '新笔记' : '新正文')}
        >
          <Plus />
        </Button>
      }
    >
      <div className="space-y-2 p-2">
        <div className="flex gap-1">
          {DOC_KINDS.map((k) => (
            <button
              key={k.kind}
              onClick={() => {
                if (k.kind === 'outline') {
                  setModule('outline');
                  return;
                }
                setKind(k.kind);
              }}
              className={cn(
                'flex-1 rounded border px-1 py-1 text-[11px] transition-colors',
                kind === k.kind ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-accent',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>

        <SectionTitle>{list.length} 篇</SectionTitle>
        <div className="space-y-0.5">
          {list.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                'group rounded px-1.5 py-1.5 transition-colors',
                doc.id === selectedDocId ? 'bg-primary/15 text-primary' : 'hover:bg-accent',
              )}
            >
              <button onClick={() => selectDoc(doc.id)} className="flex w-full items-start gap-1.5 text-left">
                <FileText className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <input
                    defaultValue={doc.title}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => updateDoc(doc.id, { title: e.target.value })}
                    className="w-full truncate rounded border border-transparent bg-transparent text-xs hover:border-border focus:border-border focus:outline-none"
                  />
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {countWords(doc.content)} 字 · {relativeTime(doc.updated_at)}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`删除文稿「${doc.title}」？`)) deleteDoc(doc.id);
                  }}
                  className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </span>
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div className="px-1 py-2 text-[11px] text-muted-foreground">
              还没有{DOC_KINDS.find((k) => k.kind === kind)?.label}，点右上角 + 新建。
            </div>
          )}
        </div>

        <SectionTitle>快速新建</SectionTitle>
        <Input
          placeholder="输入标题后回车"
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const title = (e.target as HTMLInputElement).value.trim();
              if (title) {
                createDoc(kind, title);
                (e.target as HTMLInputElement).value = '';
              }
            }
          }}
        />
      </div>
    </SidePanel>
  );
}
