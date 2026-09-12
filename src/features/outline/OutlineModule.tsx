/**
 * 大纲模块
 * ------------------------------------------------------------------
 * 需求 10：故事大纲区，可写大纲、可切换树形图展现，编辑器与写作层一致。
 * 三种视图共享同一份数据：
 *  文本（Markdown 编辑） / 树形（节点编辑） / 思维导图（全局结构）
 */
import { useEffect, useMemo, useState } from 'react';
import { Columns2, ListTree, Network, Pencil } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { MarkdownView } from '@/components/common/MarkdownView';
import { AutoInput } from '@/components/common/AutoField';
import { buildOutlineTree, outlineProgress } from '@/types';
import { useDebouncedValue } from '@/hooks/useDebounced';
import { useStore } from '@/store';
import { OutlineMindmap } from './OutlineMindmap';
import { OutlineSidebar } from './OutlineSidebar';
import { OutlineTree } from './OutlineTree';

type View = 'text' | 'tree' | 'map';

export function OutlineModule() {
  const docs = useStore((s) => s.docs);
  const outlineNodes = useStore((s) => s.outlineNodes);
  const selectedOutlineId = useStore((s) => s.selectedOutlineId);
  const selectOutline = useStore((s) => s.selectOutline);
  const updateDoc = useStore((s) => s.updateDoc);
  const createDoc = useStore((s) => s.createDoc);
  const [view, setView] = useState<View>('tree');
  const [split, setSplit] = useState(false);

  const outlines = docs.filter((d) => d.kind === 'outline');
  const doc = outlines.find((d) => d.id === selectedOutlineId);

  // 默认打开第一篇大纲
  useEffect(() => {
    if (!doc && outlines.length > 0) selectOutline(outlines[0].id);
  }, [doc, outlines, selectOutline]);

  const nodes = useMemo(() => outlineNodes.filter((n) => n.doc_id === doc?.id), [outlineNodes, doc]);
  const tree = useMemo(() => buildOutlineTree(nodes), [nodes]);
  const progress = useMemo(() => outlineProgress(nodes), [nodes]);
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
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
          <AutoInput
            value={doc.title}
            onCommit={(title) => updateDoc(doc.id, { title })}
            className="h-7 max-w-[14rem] border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
          />
          <span className="text-[10px] text-muted-foreground">
            {nodes.length} 个节点 · 完成 {progress.percent}%
          </span>
          <div className="ml-auto flex items-center gap-1">
            {view === 'text' && (
              <Tabs value={split ? 'split' : 'edit'} onValueChange={(v) => setSplit(v === 'split')}>
                <TabsList>
                  <TabsTrigger value="edit" className="gap-1">
                    <Pencil className="size-3" /> 编辑
                  </TabsTrigger>
                  <TabsTrigger value="split" className="gap-1">
                    <Columns2 className="size-3" /> 分栏
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList>
                <TabsTrigger value="text" className="gap-1">
                  <Pencil className="size-3" /> 文本
                </TabsTrigger>
                <TabsTrigger value="tree" className="gap-1">
                  <ListTree className="size-3" /> 树形
                </TabsTrigger>
                <TabsTrigger value="map" className="gap-1">
                  <Network className="size-3" /> 思维导图
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {view === 'text' && (
          <div className={`grid min-h-0 flex-1 ${split ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            <MarkdownEditor
              value={doc.content}
              onChange={(content) => updateDoc(doc.id, { content })}
              placeholder="# 第一幕&#10;## 开场&#10;- 关键节点…"
            />
            {split && (
              <div className="min-h-0 overflow-y-auto border-t border-border p-4 lg:border-l lg:border-t-0">
                <div className="mx-auto max-w-2xl">
                  <MarkdownView text={debounced} />
                </div>
              </div>
            )}
          </div>
        )}
        {view === 'tree' && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <OutlineTree docId={doc.id} nodes={tree} />
          </div>
        )}
        {view === 'map' && (
          <div className="min-h-0 flex-1">
            <OutlineMindmap nodes={tree} />
          </div>
        )}
      </ModuleBody>
    </ModuleLayout>
  );
}
