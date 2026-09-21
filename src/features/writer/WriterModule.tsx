/**
 * 写作模块
 * ------------------------------------------------------------------
 * 需求 6「零切换写作」：正文编辑器旁边实时悬浮相关设定卡片，
 * 正文里的卡片标题在预览态可直接悬停预览，不必切到卡片库。
 * 三种视图：纯文本编辑 / 只读预览 / 左右分栏。
 *
 * 「预览」是纯 UI 状态，不进 store（store 里只有 editorSplit 这个布尔偏好，
 * 也只由「纯文本 / 分栏」两态驱动），所以这里用组件本地状态 tab：
 * 它初始化时读一次 store 的偏好（保留用户上次选的分栏），用户点页签时再写回去。
 */
import { useEffect, useState } from 'react';
import { Columns2, Eye, Pencil, Focus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hint } from '@/components/ui/tooltip';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { AutoInput } from '@/components/common/AutoField';
import { countWords } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebounced';
import { useStore } from '@/store';
import { WriterInspector } from './WriterInspector';
import { WriterPreviewPane } from './WriterPreviewPane';
import { WriterSidebar } from './WriterSidebar';

/** 视图模式：纯文本 / 预览 / 分栏 */
type WriterTab = 'text' | 'preview' | 'split';

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

  /** 三态视图（本地）；初始值沿用 store 里上次「分栏」的偏好 */
  const [tab, setTab] = useState<WriterTab>(split ? 'split' : 'text');
  /** 一旦用户自己点过页签，就不再被 store 覆盖 */
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    if (!userPicked) setTab(split ? 'split' : 'text');
  }, [split, userPicked]);

  /** 切换视图：只有「纯文本 / 分栏」两态回写 store 的分栏偏好（预览只是看，不该改动它） */
  const changeTab = (next: WriterTab) => {
    setUserPicked(true);
    setTab(next);
    if (next !== 'preview') setSplit(next === 'split');
  };

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
            <Tabs value={tab} onValueChange={(v) => changeTab(v as WriterTab)}>
              <TabsList>
                <TabsTrigger value="text" className="gap-1">
                  <Pencil className="size-3" /> 纯文本
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1">
                  <Eye className="size-3" /> 预览
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

        {/*
          高度：容器 flex-1 + 网格行高 auto-rows-fr（行高按容器空间分配），
          格子里的元素再 h-full / min-h-0 —— 三样齐全才是「撑满 + 超了自己滚」，
          少一样就会出现下面留白或内容把整页顶高。
        */}
        <div
          className={cn(
            'grid min-h-0 flex-1 auto-rows-fr overflow-hidden',
            tab === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
          )}
        >
          {/* 纯文本：编辑器占满整宽；分栏：左半编辑 */}
          {tab !== 'preview' && (
            <MarkdownEditor
              value={draft}
              onChange={(v) => doc && updateDoc(doc.id, { content: v })}
              className="h-full min-h-0"
              placeholder="开始写作…输入 [[ 可引用设定卡片；提到已存在的卡片标题会自动变成可悬停预览的双链"
            />
          )}
          {/* 分栏：右半预览（带左侧分隔线）；预览：整宽预览 */}
          {tab === 'split' && (
            <WriterPreviewPane text={debounced} className="border-t border-border p-4 lg:border-l lg:border-t-0" />
          )}
          {tab === 'preview' && <WriterPreviewPane text={debounced} className="p-4" />}
        </div>
      </ModuleBody>

      <WriterInspector text={draft} />
    </ModuleLayout>
  );
}
