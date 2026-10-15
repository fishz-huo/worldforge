/**
 * 树里的可编辑标题
 * ------------------------------------------------------------------
 * 单击 = 选中（2px 外框），双击 = 进入编辑（B1：避免与"选中"抢手势、也不误触）。
 * 提交走 renameOutlineNode：I4 先在纯函数里核对标题还在原处、I3 先改行再写文本。
 * 只读态仍是 OutlineStatusChip（底色只包文字 + 1px 内描边），色号一处不改；
 * 编辑态换成输入框，沿用同一套状态底色与字色。
 */
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ProjectedNode } from './outlineProjection';
import { OutlineStatusChip } from './OutlineStatusChip';
import { renameOutlineNode } from './outlineStore';
import { statusStyle } from './outlineStatus';

export function OutlineTreeTitle({
  docId,
  node,
  selected,
  onSelect,
}: {
  docId: string;
  node: ProjectedNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  /** 一次编辑只提交一次：Enter 之后紧跟着的 blur 不许再写第二遍 */
  const done = useRef(false);

  const startEdit = () => {
    done.current = false;
    setDraft(node.title);
    setEditing(true);
  };

  const commit = () => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    renameOutlineNode(docId, node, draft);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            done.current = true;
            setEditing(false);
          }
        }}
        // 编辑中不画删除线（一边打字一边打叉太别扭），底色与描边仍跟状态走
        className={cn(statusStyle(node.status).chip.replace('line-through', ''), 'w-full border-0 text-xs outline-none')}
      />
    );
  }

  return (
    <span
      onClick={onSelect}
      onDoubleClick={startEdit}
      className={cn(
        'inline-block cursor-text rounded-sm',
        selected && 'outline outline-2 outline-offset-2 outline-primary',
      )}
    >
      <OutlineStatusChip status={node.status} title={`${node.title}（双击改标题）`} className="text-xs">
        {node.title}
      </OutlineStatusChip>
    </span>
  );
}
