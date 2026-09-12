/**
 * 写作模块
 * ------------------------------------------------------------------
 * 需求 6「零切换写作」：正文编辑器旁边实时悬浮相关设定卡片，
 * 正文里的卡片标题在预览态可直接悬停预览，不必切到卡片库。
 * 三种视图：纯文本编辑 / 实时预览 / 左右分栏。
 */
import { useEffect } from 'react';
import { Columns2, Pencil, Focus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hint } from '@/components/ui/tooltip';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { MarkdownView } from '@/components/common/MarkdownView';
import { AutoInput } from '@/components/common/AutoField';
import { countWords } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebounced';
import { useStore } from '@/store';
import { WriterInspector } from './WriterInspector';
import { WriterSidebar } from './WriterSidebar';

/** 视图模式 */
type ViewMode = 'edit' | 'preview' | 'split';

export function WriterModule() {
  const docs = useStore((s) => s.docs);
  const selectedDocId = useStore((s) => s.selectedDocId);
  const selectDoc = useStore((s) => s.selectDoc);
  const updateDoc = useStore((s) => s.updateDoc);
  const createDoc = useStore((s) => s.createDoc);
  const split = useStore((s) => s.editorSplit);
  const setSplit = useStore((s) => s.setEditorSplit);
  const toggleFocus = useStore((s) => s.toggleFocus);
  const focusMode = useStore((s) => s.focusMode);

  const manuscripts = docs.filter((d) => d.kind !== 'outline');
  const doc = docs.find((d) => d.id === selectedDocId && d.kind !== 'outline');

  // 未选中时默认打开第一篇正文
  useEffect(() => {
    if (!doc && manuscripts.length > 0) selectDoc(manuscripts[0].id);
  }, [doc, manuscripts, selectDoc]);

  const mode: ViewMode = split ? 'split' : 'edit';
  const draft = doc?.content ?? '';
  const debounced = useDebouncedValue(draft, 400);

  if (!doc) {
    return (
      <ModuleLayout>
        <WriterSidebar />
        <ModuleBody>
          <EmptyState
            icon={<Pencil />}
            title="还没有正文文稿"
            description="在左侧新建一篇正文，然后在写作时用 [[ 引用设定卡片。"
            action={
              <Button size="sm" className="mt-2" onClick={() => createDoc('manuscript', '第一章')}>
                新建正文
              </Button>
            }
          />
        </ModuleBody>
        <WriterInspector text="" />
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <WriterSidebar />

      <ModuleBody>
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
          <AutoInput
            value={doc.title}
            onCommit={(title) => updateDoc(doc.id, { title })}
            className="h-7 max-w-xs border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
            placeholder="文稿标题"
          />
          <span className="text-[10px] text-muted-foreground">{countWords(doc.content)} 字</span>
          <div className="ml-auto flex items-center gap-1">
            <Tabs value={split ? 'split' : 'edit'} onValueChange={(v) => setSplit(v === 'split')}>
              <TabsList>
                <TabsTrigger value="edit" className="gap-1">
                  <Pencil className="size-3" /> 纯文本
                </TabsTrigger>
                <TabsTrigger value="split" className="gap-1">
                  <Columns2 className="size-3" /> 分栏
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Hint label={focusMode ? '退出专注模式' : '专注写作'}>
              <Button variant={focusMode ? 'secondary' : 'ghost'} size="icon-sm" onClick={toggleFocus}>
                <Focus />
              </Button>
            </Hint>
          </div>
        </div>

        <div className={cn('grid min-h-0 flex-1', mode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
          <MarkdownEditor
            value={draft}
            onChange={(v) => doc && updateDoc(doc.id, { content: v })}
            className="min-h-0"
            placeholder="开始写作…输入 [[ 可引用设定卡片；提到已存在的卡片标题会自动变成可悬停预览的双链"
          />
          {mode === 'split' && (
            <div className="min-h-0 overflow-y-auto border-t border-border p-4 lg:border-l lg:border-t-0">
              <div className="mx-auto max-w-2xl">
                <MarkdownView text={debounced} onCardClick={(id) => useStore.getState().selectCard(id)} />
              </div>
            </div>
          )}
        </div>
      </ModuleBody>

      <WriterInspector text={draft} />
    </ModuleLayout>
  );
}
