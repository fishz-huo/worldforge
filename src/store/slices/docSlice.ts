/**
 * Doc Slice —— 文稿（正文 / 大纲文本 / 笔记）的增删改
 * ------------------------------------------------------------------
 * 需求 10 与需求 6：写作层与大纲层共用同一套 Markdown 文稿。
 * 大纲树的节点操作见 outlineSlice.ts。
 */
import type { Doc, DocKind } from '@/types';
import { newDocId } from '@/lib/id';
import { docsRepo, outlineRepo } from '@/lib/db';
import { emitPluginEvent } from '@/lib/plugin/events';
import { nextOrder, removeById, removeWhere, upsert } from '../helpers';
import type { Slice } from '../types';

export interface DocSlice {
  createDoc: (kind: DocKind, title?: string) => string;
  updateDoc: (id: string, patch: Partial<Doc>) => void;
  deleteDoc: (id: string) => void;
}

/** 各类文稿的初始内容模板 */
function initialContent(kind: DocKind, title: string): string {
  if (kind === 'outline') return '# 新大纲\n\n## 第一幕\n- \n';
  return `# ${title}\n\n`;
}

export const createDocSlice: Slice<DocSlice> = (set, get) => ({
  createDoc: (kind, title = '未命名文稿') => {
    const worldId = get().currentWorldId;
    if (!worldId) return '';
    const now = Date.now();
    const doc: Doc = {
      id: newDocId(),
      world_id: worldId,
      branch_id: get().currentBranchId,
      kind,
      title,
      content: initialContent(kind, title),
      summary: '',
      order_index: nextOrder(get().docs),
      card_id: null,
      created_at: now,
      updated_at: now,
    };
    docsRepo.save(doc);
    set({ docs: [...get().docs, doc] });
    // 新建后自动选中：大纲进大纲模块，其余进写作模块
    if (kind === 'outline') set({ selectedOutlineId: doc.id });
    else set({ selectedDocId: doc.id });
    return doc.id;
  },

  updateDoc: (id, patch) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    const next = { ...doc, ...patch, updated_at: Date.now() };
    docsRepo.save(next);
    set({ docs: upsert(get().docs, next) });
    emitPluginEvent('doc:save', next);
  },

  deleteDoc: (id) => {
    docsRepo.remove(id);
    outlineRepo.removeWhere('doc_id = ?', [id]);
    set({
      docs: removeById(get().docs, id),
      outlineNodes: removeWhere(get().outlineNodes, (n) => n.doc_id === id),
      selectedDocId: get().selectedDocId === id ? null : get().selectedDocId,
      selectedOutlineId: get().selectedOutlineId === id ? null : get().selectedOutlineId,
    });
    get().toast('文稿已删除', 'warn');
  },
});
