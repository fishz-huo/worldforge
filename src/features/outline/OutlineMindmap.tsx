/**
 * 大纲思维导图视图
 * ------------------------------------------------------------------
 * 需求 10：大纲可切换树形图展现。这里用 SVG 手绘思维导图，
 * 不引入图形库：布局算法只有「按深度定 x、按后序累计定 y」两步，
 * 父节点纵向居中于子节点之间，连线用三次贝塞尔。
 */
import { useMemo, useState } from 'react';
import { OUTLINE_STATUS, type OutlineTreeNode } from '@/types';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

/** 布局参数 */
const COL_W = 200;
const ROW_H = 46;
const NODE_W = 168;
const NODE_H = 34;

interface Placed {
  node: OutlineTreeNode;
  x: number;
  y: number;
}

/** 计算所有节点坐标 */
function layout(tree: OutlineTreeNode[]): { placed: Placed[]; edges: [Placed, Placed][]; height: number } {
  const placed: Placed[] = [];
  const edges: [Placed, Placed][] = [];
  let cursorY = 0;

  const walk = (node: OutlineTreeNode, depth: number): Placed => {
    const x = depth * COL_W + 16;
    let y: number;
    if (node.children.length === 0) {
      y = cursorY;
      cursorY += ROW_H;
    } else {
      const childPlaced = node.children.map((child) => walk(child, depth + 1));
      y = (childPlaced[0].y + childPlaced[childPlaced.length - 1].y) / 2;
      const self: Placed = { node, x, y };
      childPlaced.forEach((child) => edges.push([self, child]));
      placed.push(self);
      return self;
    }
    const self: Placed = { node, x, y };
    placed.push(self);
    return self;
  };

  tree.forEach((root) => walk(root, 0));
  return { placed, edges, height: Math.max(120, cursorY + 20) };
}

export function OutlineMindmap({ nodes }: { nodes: OutlineTreeNode[] }) {
  const updateOutlineNode = useStore((s) => s.updateOutlineNode);
  const selectCard = useStore((s) => s.selectCard);
  const cards = useStore((s) => s.cards);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { placed, edges, height } = useMemo(() => layout(nodes), [nodes]);
  const width = useMemo(
    () => Math.max(320, ...placed.map((p) => p.x + NODE_W + 24)),
    [placed],
  );
  const active = placed.find((p) => p.node.id === activeId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto bg-grid p-2">
        <svg width={width} height={height} className="select-none">
          {/* 连线 */}
          {edges.map(([from, to], i) => {
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={1.2}
              />
            );
          })}
          {/* 节点 */}
          {placed.map((p) => {
            const status = OUTLINE_STATUS.find((s) => s.status === p.node.status) ?? OUTLINE_STATUS[0];
            const isActive = p.node.id === activeId;
            return (
              <g
                key={p.node.id}
                transform={`translate(${p.x}, ${p.y})`}
                className="cursor-pointer"
                onClick={() => setActiveId(isActive ? null : p.node.id)}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  fill="hsl(var(--card))"
                  stroke={isActive ? 'hsl(var(--primary))' : status.color}
                  strokeWidth={isActive ? 2 : 1.2}
                />
                <rect width={4} height={NODE_H} rx={2} fill={status.color} />
                <text x={12} y={15} className="fill-foreground" style={{ fontSize: 11 }}>
                  {p.node.title.length > 14 ? `${p.node.title.slice(0, 14)}…` : p.node.title}
                </text>
                <text x={12} y={27} className="fill-muted-foreground" style={{ fontSize: 9 }}>
                  {p.node.summary
                    ? p.node.summary.length > 18
                      ? `${p.node.summary.slice(0, 18)}…`
                      : p.node.summary
                    : status.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 选中节点操作条 */}
      {active && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-1.5 text-xs">
          <span className="font-medium">{active.node.title}</span>
          <span className="text-muted-foreground">{active.node.summary}</span>
          <div className="ml-auto flex items-center gap-1">
            {OUTLINE_STATUS.map((s) => (
              <button
                key={s.status}
                onClick={() => updateOutlineNode(active.node.id, { status: s.status })}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10px]',
                  active.node.status === s.status ? 'border-primary text-primary' : 'border-border hover:bg-accent',
                )}
              >
                {s.label}
              </button>
            ))}
            {active.node.card_id && (
              <button
                onClick={() => selectCard(active.node.card_id!)}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-primary hover:text-primary"
              >
                {cards.find((c) => c.id === active.node.card_id)?.title ?? '关联卡片'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
