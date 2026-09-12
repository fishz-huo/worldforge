/**
 * 差异展示的基础组件
 * ------------------------------------------------------------------
 * 行级 diff 渲染、可折叠区块、卡片差异行。
 * 从 SnapshotDiffView 拆出来，让「差异视图」专注于组织信息结构。
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { collapseContext, diffLines, diffStats } from '@/lib/diff';
import { FIELD_LABELS, changedFieldKeys } from '@/lib/snapshot-diff';
import { cn } from '@/lib/utils';
import type { Card } from '@/types';

/** 行级差异块 */
export function LineDiff({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => collapseContext(diffLines(before, after), 1), [before, after]);
  const stats = useMemo(() => diffStats(diffLines(before, after)), [before, after]);

  return (
    <div className="mt-1 overflow-hidden rounded border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
        <span className="text-emerald-400">+{stats.added}</span>
        <span className="text-destructive">-{stats.removed}</span>
      </div>
      <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-5">
        {lines.map((line, i) =>
          line.type === 'gap' ? (
            <div key={i} className="bg-muted/30 px-2 text-center text-[10px] text-muted-foreground">
              {line.text}
            </div>
          ) : (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap px-2',
                line.type === 'add' && 'bg-emerald-500/10 text-emerald-300',
                line.type === 'del' && 'bg-destructive/10 text-destructive-foreground/80 line-through',
              )}
            >
              {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
              {line.text || ' '}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/** 可折叠的差异区块；count 为 0 时整块不渲染 */
export function DiffSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <section className="rounded-lg border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold hover:bg-accent/50"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {title}
        <Badge variant="outline" className="ml-1 border-0 bg-muted text-[10px]">
          {count}
        </Badge>
      </button>
      {open && <div className="border-t border-border p-2">{children}</div>}
    </section>
  );
}

/** 卡片差异行 */
export function CardDiffRow({
  card,
  kind,
  detail,
}: {
  card: Card;
  kind: 'add' | 'del' | 'change';
  detail?: React.ReactNode;
}) {
  const def = getCardType(card.type);
  return (
    <div className="rounded border border-border/60 p-1.5">
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            'rounded px-1 text-[10px] font-semibold',
            kind === 'add' && 'bg-emerald-500/20 text-emerald-300',
            kind === 'del' && 'bg-destructive/20 text-destructive',
            kind === 'change' && 'bg-amber-500/20 text-amber-300',
          )}
        >
          {kind === 'add' ? '新增' : kind === 'del' ? '删除' : '修改'}
        </span>
        <Icon name={def.icon} className="size-3.5" style={{ color: def.color }} />
        <span className="min-w-0 flex-1 truncate">{card.title}</span>
        <span className="text-[10px] text-muted-foreground">{def.label}</span>
      </div>
      {detail}
    </div>
  );
}

/** 修改类卡片的字段变化徽标 + 正文 diff */
export function CardChangeDetail({ before, after }: { before: Card; after: Card }) {
  const changed = (Object.keys(before) as (keyof Card)[]).filter(
    (key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null),
  );
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1">
        {changed.map((f) => (
          <Badge key={String(f)} variant="outline" className="border-0 bg-muted text-[10px]">
            {FIELD_LABELS[String(f)] ?? String(f)}
          </Badge>
        ))}
        {changedFieldKeys(before, after).map((k) => (
          <Badge key={k} variant="warn" className="text-[10px]">
            字段 {k}
          </Badge>
        ))}
      </div>
      {(before.body !== after.body || before.summary !== after.summary) && (
        <LineDiff
          before={`${before.summary}\n${before.body}`}
          after={`${after.summary}\n${after.body}`}
        />
      )}
    </div>
  );
}
