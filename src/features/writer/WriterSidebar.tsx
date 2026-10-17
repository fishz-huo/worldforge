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
import { askConfirm } from '@/lib/confirm';
import { DocTitleField } from './DocTitleField';

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
              onClick={async () => {
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
          {/*
            行容器是 div：标题输入框不能套在 button 里（点行内空白会让输入框失焦，
            焦点交给 button 并触发 click —— 这正是「标题被写回旧值」的触发面）。
            选中＝行内任意位置点击，图标另给一个 button 让键盘也能选。
          */}
          {list.map((doc) => (
            <div
              key={doc.id}
              onClick={() => selectDoc(doc.id)}
              className={cn(
                'group rounded px-1.5 py-1.5 transition-colors',
                doc.id === selectedDocId ? 'bg-primary/15 text-primary' : 'hover:bg-accent',
              )}
            >
              <div className="flex w-full items-start gap-1.5 text-left">
                <button
                  type="button"
                  title={`打开「${doc.title}」`}
                  aria-label={`打开「${doc.title}」`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectDoc(doc.id);
                  }}
                  className="mt-0.5 flex shrink-0"
                >
                  <FileText className="size-3.5" />
                </button>
                <span className="min-w-0 flex-1">
                  <DocTitleField
                    value={doc.title}
                    onCommit={(title) => updateDoc(doc.id, { title })}
                    onFocus={() => selectDoc(doc.id)}
                    className="w-full truncate rounded border border-transparent bg-transparent text-xs hover:border-border focus:border-border focus:outline-none"
                  />
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {countWords(doc.content)} 字 · {relativeTime(doc.updated_at)}
                  </span>
                </span>
                <button
                  type="button"
                  title={`删除「${doc.title}」`}
                  aria-label={`删除「${doc.title}」`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (await askConfirm(`删除文稿「${doc.title}」？`)) deleteDoc(doc.id);
                  }}
                  className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
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
