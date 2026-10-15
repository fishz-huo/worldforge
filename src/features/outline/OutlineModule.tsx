/**
 * 大纲模块
 * ------------------------------------------------------------------
 * 需求 10：故事大纲区，可写大纲、可切换树形图展现，编辑器与写作层一致。
 * 四种视图共享同一份真相源 —— 文稿正文（docs.content）里的 Markdown 标题：
 *  纯文本 / 树形 / 思维导图 / 分栏（默认纯文本）
 * outline_nodes 只提供额外信息（状态、摘要、卡片挂接），由 useOutlineSync
 * 按「标题 + 第几次出现」自动对齐，不需要用户手动点任何同步按钮。
 * 状态色块与图例分别见 outlineStatus / OutlineStatusChip / OutlineLegend。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ListTree } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { MarkdownView } from '@/components/common/MarkdownView';
import { outlineProgress } from '@/types';
import { useDebouncedValue } from '@/hooks/useDebounced';
import { useStore } from '@/store';
import { OutlineLegend } from './OutlineLegend';
import { OutlineMindmap } from './OutlineMindmap';
import { OutlineSidebar } from './OutlineSidebar';
import { OutlineSyncNotice } from './OutlineSyncNotice';
import { OutlineTabs, type OutlineView } from './OutlineTabs';
import { OutlineTree } from './OutlineTree';
import { useOutlineSync } from './useOutlineSync';
import { writeTreeToText } from './outlineStore';

/** 带图例浮层的视图外壳（图例只出现在有状态色块的两个视图里） */
function ViewShell({ legend, children }: { legend?: boolean; children: ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {legend && <OutlineLegend className="absolute right-3 top-2 z-10" />}
      {children}
    </div>
  );
}

export function OutlineModule() {
  const docs = useStore((s) => s.docs);
  const selectedOutlineId = useStore((s) => s.selectedOutlineId);
  const selectOutline = useStore((s) => s.selectOutline);
  const updateDoc = useStore((s) => s.updateDoc);
  const createDoc = useStore((s) => s.createDoc);
  const [view, setView] = useState<OutlineView>('text');

  const outlines = docs.filter((d) => d.kind === 'outline');
  const doc = outlines.find((d) => d.id === selectedOutlineId);

  // 默认打开第一篇大纲
  useEffect(() => {
    if (!doc && outlines.length > 0) selectOutline(outlines[0].id);
  }, [doc, outlines, selectOutline]);

  // 投影 = 文本标题（结构） + 库行（状态/摘要/卡片）；写库按 500ms 去抖
  const { projection, showGuide, dismissGuide } = useOutlineSync(doc?.id ?? null, doc?.content ?? '');
  const progress = useMemo(() => outlineProgress(projection.flat), [projection]);
  const debounced = useDebouncedValue(doc?.content ?? '', 400);

  if (!doc) {
    return (
      <ModuleLayout>
        <OutlineSidebar progress={{ done: 0, total: 0, percent: 0 }} />
        <ModuleBody>
          <EmptyState
            icon={<ListTree />}
            title="还没有大纲"
            description="大纲可以直接当 Markdown 写，也可以切成树形或思维导图。"
            action={
              <button
                onClick={() => createDoc('outline', '主线大纲')}
                className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
              >
                新建大纲
              </button>
            }
          />
        </ModuleBody>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <OutlineSidebar progress={progress} />

      <ModuleBody>
        <OutlineTabs
          title={doc.title}
          onTitleCommit={(title) => updateDoc(doc.id, { title })}
          view={view}
          onViewChange={setView}
        />

        {showGuide && (
          <OutlineSyncNotice
            stats={projection.stats}
            onWriteTree={() => writeTreeToText(doc.id)}
            onUseText={dismissGuide}
          />
        )}

        {view === 'text' && (
          <MarkdownEditor
            value={doc.content}
            onChange={(content) => updateDoc(doc.id, { content })}
            placeholder="# 第一幕&#10;## 开场&#10;- 关键节点…"
          />
        )}

        {view === 'split' && (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
            <MarkdownEditor
              value={doc.content}
              onChange={(content) => updateDoc(doc.id, { content })}
              placeholder="# 第一幕&#10;## 开场&#10;- 关键节点…"
            />
            <div className="min-h-0 overflow-y-auto border-t border-border p-4 lg:border-l lg:border-t-0">
              <div className="mx-auto max-w-2xl">
                <MarkdownView text={debounced} />
              </div>
            </div>
          </div>
        )}

        {view === 'tree' && (
          <ViewShell legend>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <OutlineTree docId={doc.id} nodes={projection.roots} />
            </div>
          </ViewShell>
        )}

        {view === 'map' && (
          <ViewShell legend>
            <OutlineMindmap docId={doc.id} nodes={projection.roots} />
          </ViewShell>
        )}
      </ModuleBody>
    </ModuleLayout>
  );
}
