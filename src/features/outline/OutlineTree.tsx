/**
 * 大纲树视图
 * ------------------------------------------------------------------
 * 树 = 文本里的 Markdown 标题（结构） + outline_nodes 行（额外信息）。
 * 所以这里只改「额外信息」：状态、摘要、卡片挂接。
 * 增删节点、改层级、改标题一律回文本里做 —— 结构编辑的按钮因此全部移除。
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { OUTLINE_STATUS, type OutlineNode, type OutlineStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { CardPicker } from '@/features/cards/CardPicker';
import type { ProjectedNode } from './outlineProjection';
import { ensureOutlineRow } from './outlineStore';

/** 状态切换圆点：点击循环到下一个状态（R2 会换成文字底色色块） */
function StatusDot({ docId, node }: { docId: string; node: ProjectedNode }) {
  const updateOutlineNode = useStore((s) => s.updateOutlineNode);
  const index = OUTLINE_STATUS.findIndex((s) => s.status === node.status);
  const current = OUTLINE_STATUS[index] ?? OUTLINE_STATUS[0];
  return (
    <button
      title={`状态：${current.label}（点击切换）`}
      onClick={() => {
        const id = ensureOutlineRow(docId, node);
        if (!id) return;
        const next = OUTLINE_STATUS[(index + 1) % OUTLINE_STATUS.length].status as OutlineStatus;
        updateOutlineNode(id, { status: next });
      }}
      className="size-2.5 shrink-0 rounded-sm ring-offset-1 ring-offset-background hover:ring-1 hover:ring-border"
      style={{ background: current.color }}
    />
  );
}

/** 单个节点行 */
function NodeRow({ node, docId }: { node: ProjectedNode; docId: string }) {
  const updateOutlineNode = useStore((s) => s.updateOutlineNode);
  const card = useStore((s) => (node.card_id ? s.cards.find((c) => c.id === node.card_id) : undefined));
  const selectCard = useStore((s) => s.selectCard);
  const [open, setOpen] = useState(true);
  const [picking, setPicking] = useState(false);
  const hasChildren = node.children.length > 0;

  /** 改「额外信息」前先确保库里有行（打字后 500ms 内也能点到这个节点） */
  const write = (patch: Partial<OutlineNode>) => {
    const id = ensureOutlineRow(docId, node);
    if (id) updateOutlineNode(id, patch);
  };

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
        <StatusDot docId={docId} node={node} />
        <div className="min-w-0 flex-1">
          <div className="truncate px-1 text-xs font-medium" title={node.title}>
            {node.title}
          </div>
          <input
            key={node.id}
            defaultValue={node.summary}
            placeholder="补充说明…"
            onBlur={(e) => {
              if (e.target.value !== node.summary) write({ summary: e.target.value });
            }}
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
          <Button variant="ghost" size="icon-sm" title="挂接卡片" onClick={() => setPicking(true)}>
            <Link2 />
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
        onSelect={(id) => write({ card_id: id })}
      />
    </div>
  );
}

/** 大纲树 */
export function OutlineTree({ docId, nodes }: { docId: string; nodes: ProjectedNode[] }) {
  return (
    <div className="p-2">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[10px] text-muted-foreground">
        <span>点击圆点切换状态</span>
        <span>· 节点的增删与层级请在「纯文本」里改 # 标题</span>
      </div>
      {nodes.length === 0 ? (
        <div className="px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">
          还没有节点。切到「纯文本」，用 <span className="font-mono"># 第一幕</span> 这样的标题写大纲，
          树形与思维导图会自动跟着长出来。
        </div>
      ) : (
        nodes.map((node) => <NodeRow key={node.id} node={node} docId={docId} />)
      )}
    </div>
  );
}
