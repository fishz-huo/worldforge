/**
 * 大纲树视图
 * ------------------------------------------------------------------
 * 需求 10：可切换树形图展现大纲。
 * 每个节点可直接改标题、切状态、挂接卡片、增删子节点、上下移动与升降层级。
 */
import { useState } from 'react';
import {
  ChevronDown, ChevronRight, CornerDownRight, CornerUpLeft, GripVertical,
  Link2, Minus, Plus, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { OUTLINE_STATUS, type OutlineStatus, type OutlineTreeNode } from '@/types';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { CardPicker } from '@/features/cards/CardPicker';

/** 状态切换按钮：点击循环到下一个状态 */
function StatusDot({ nodeId, status }: { nodeId: string; status: OutlineStatus }) {
  const updateOutlineNode = useStore((s) => s.updateOutlineNode);
  const index = OUTLINE_STATUS.findIndex((s) => s.status === status);
  const current = OUTLINE_STATUS[index] ?? OUTLINE_STATUS[0];
  return (
    <button
      title={`状态：${current.label}（点击切换）`}
      onClick={() => updateOutlineNode(nodeId, { status: OUTLINE_STATUS[(index + 1) % OUTLINE_STATUS.length].status })}
      className="size-2.5 shrink-0 rounded-sm ring-offset-1 ring-offset-background hover:ring-1 hover:ring-border"
      style={{ background: current.color }}
    />
  );
}

/** 单个节点行 */
function NodeRow({ node, docId }: { node: OutlineTreeNode; docId: string }) {
  const updateOutlineNode = useStore((s) => s.updateOutlineNode);
  const deleteOutlineNode = useStore((s) => s.deleteOutlineNode);
  const addOutlineNode = useStore((s) => s.addOutlineNode);
  const moveOutlineNode = useStore((s) => s.moveOutlineNode);
  const indentOutlineNode = useStore((s) => s.indentOutlineNode);
  const card = useStore((s) => (node.card_id ? s.cards.find((c) => c.id === node.card_id) : undefined));
  const selectCard = useStore((s) => s.selectCard);
  const [open, setOpen] = useState(true);
  const [picking, setPicking] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="group flex items-start gap-1 rounded px-1 py-1 hover:bg-accent/50"
        style={{ marginLeft: node.depth * 18 }}
      >
        <button
          onClick={() => setOpen(!open)}
          className={cn('mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground', !hasChildren && 'opacity-30')}
        >
          {hasChildren ? open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" /> : <GripVertical className="size-3.5" />}
        </button>
        <StatusDot nodeId={node.id} status={node.status} />
        <div className="min-w-0 flex-1">
          <input
            defaultValue={node.title}
            onBlur={(e) => updateOutlineNode(node.id, { title: e.target.value })}
            className="w-full rounded border border-transparent bg-transparent px-1 text-xs font-medium hover:border-border focus:border-border focus:outline-none"
          />
          <input
            defaultValue={node.summary}
            placeholder="补充说明…"
            onBlur={(e) => updateOutlineNode(node.id, { summary: e.target.value })}
            className="w-full rounded border border-transparent bg-transparent px-1 text-[10px] text-muted-foreground hover:border-border focus:border-border focus:outline-none"
          />
          {card && (
            <button
              onClick={() => selectCard(card.id)}
              className="ml-1 mt-0.5 inline-flex items-center gap-1 rounded bg-muted px-1 py-0.5 text-[10px] hover:text-primary"
            >
              <Icon name={getCardType(card.type).icon} className="size-2.5" style={{ color: getCardType(card.type).color }} />
              {card.title}
            </button>
          )}
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon-sm" title="添加子节点" onClick={() => addOutlineNode(docId, node.id)}>
            <Plus />
          </Button>
          <Button variant="ghost" size="icon-sm" title="上移" onClick={() => moveOutlineNode(node.id, 'up')}>
            <CornerUpLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" title="下移" onClick={() => moveOutlineNode(node.id, 'down')}>
            <CornerDownRight />
          </Button>
          <Button variant="ghost" size="icon-sm" title="降低层级" onClick={() => indentOutlineNode(node.id, 1)}>
            <Minus />
          </Button>
          <Button variant="ghost" size="icon-sm" title="提升层级" onClick={() => indentOutlineNode(node.id, -1)}>
            <Plus className="rotate-45" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="挂接卡片" onClick={() => setPicking(true)}>
            <Link2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="删除节点"
            className="text-destructive"
            onClick={() => deleteOutlineNode(node.id)}
          >
            <Trash2 />
          </Button>
        </div>
        {node.status === 'done' && <Badge variant="success" className="mt-0.5 shrink-0 text-[9px]">完成</Badge>}
      </div>

      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <NodeRow key={child.id} node={child} docId={docId} />
          ))}
        </div>
      )}

      <CardPicker
        open={picking}
        onOpenChange={setPicking}
        title="把大纲节点挂接到哪张卡片？"
        onSelect={(id) => updateOutlineNode(node.id, { card_id: id })}
      />
    </div>
  );
}

/** 大纲树 */
export function OutlineTree({ docId, nodes }: { docId: string; nodes: OutlineTreeNode[] }) {
  const addOutlineNode = useStore((s) => s.addOutlineNode);
  return (
    <div className="p-2">
      <div className="mb-2 flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
        <span>点击色块切换状态</span>
        <span>· 悬停节点显示操作</span>
        <Button variant="outline" size="sm" className="ml-auto h-6 gap-1 text-[10px]" onClick={() => addOutlineNode(docId, null)}>
          <Plus className="size-3" /> 添加根节点
        </Button>
      </div>
      {nodes.length === 0 ? (
        <div className="px-2 py-8 text-center text-xs text-muted-foreground">
          还没有节点。可以「添加根节点」，或在侧栏用「文本标题重建大纲树」一键生成。
        </div>
      ) : (
        nodes.map((node) => <NodeRow key={node.id} node={node} docId={docId} />)
      )}
    </div>
  );
}
