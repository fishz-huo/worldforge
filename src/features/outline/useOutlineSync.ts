/**
 * 大纲自动同步的 React 接线
 * ------------------------------------------------------------------
 * 文本是唯一真相源，所以这里一行都不会写 docs.content，
 * 去抖也只作用在"写库"那一步：敲到「## 矿」界面立刻有节点，
 * 但库里要等你停手 500ms 才补行。
 * 真正的落地动作在 outlineStore.ts（拆开是为了自测能直接 import）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import { needsGuide, projectOutline, type Projection } from './outlineProjection';
import { SYNC_DELAY, applyNodeSync } from './outlineStore';

export interface OutlineSync {
  projection: Projection;
  /** 顶部引导条要不要出现（两边都有落空时才出，见 needsGuide） */
  showGuide: boolean;
  dismissGuide: () => void;
}

/** 挂到 OutlineModule 上：返回投影 + 引导条状态，并按去抖写库 */
export function useOutlineSync(docId: string | null, content: string): OutlineSync {
  const allNodes = useStore((s) => s.outlineNodes);
  const projection = useMemo(
    () => projectOutline(content, docId ? allNodes.filter((n) => n.doc_id === docId) : [], docId ?? ''),
    [content, allNodes, docId],
  );

  // 停手 500ms 后补行 / 改名 / 对齐结构（只写 outline_nodes，不写文本）
  useEffect(() => {
    if (!docId) return;
    const timer = setTimeout(() => applyNodeSync(docId), SYNC_DELAY);
    return () => clearTimeout(timer);
  }, [docId, content]);

  // 切大纲 / 卸载时把还没轮到的那次同步落掉，免得刚敲的标题没有行
  useEffect(() => {
    if (!docId) return;
    return () => { applyNodeSync(docId); };
  }, [docId]);

  const [dismissed, setDismissed] = useState<string | null>(null);
  const dismissGuide = useCallback(() => setDismissed(docId), [docId]);
  return { projection, showGuide: needsGuide(projection.stats) && dismissed !== docId, dismissGuide };
}
