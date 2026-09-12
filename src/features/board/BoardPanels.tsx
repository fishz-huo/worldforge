/**
 * 总览页的信息区块
 * ------------------------------------------------------------------
 * 从 BoardModule 拆出来：每个区块只关心自己那块数据，
 * 主模块只负责排版与统计卡片。
 */
import { useMemo } from 'react';
import { AlertTriangle, Atom, CalendarClock, Star, TrendingUp } from 'lucide-react';
import { SectionTitle } from '@/components/ui/primitives';
import { Icon } from '@/components/Icon';
import { listCardTypes } from '@/lib/plugin/registry';
import { relativeTime } from '@/lib/utils';
import { useStore } from '@/store';

/** 跳转到卡片库并选中某张卡 */
function useOpenCard() {
  const selectCard = useStore((s) => s.selectCard);
  const setModule = useStore((s) => s.setModule);
  return (id: string) => {
    setModule('cards');
    selectCard(id);
  };
}

/** 卡片构成（按类型） */
export function TypeBreakdown() {
  const cards = useStore((s) => s.cards);
  const setCardType = useStore((s) => s.setCardType);
  const setModule = useStore((s) => s.setModule);
  const stats = listCardTypes()
    .map((def) => ({ def, count: cards.filter((c) => c.type === def.type).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <section className="rounded-lg border border-border p-3">
      <SectionTitle>
        <span className="flex items-center gap-1">
          <TrendingUp className="size-3" /> 卡片构成
        </span>
      </SectionTitle>
      <div className="space-y-1.5">
        {stats.map(({ def, count }) => (
          <button
            key={def.type}
            onClick={() => {
              setModule('cards');
              setCardType(def.type);
            }}
            className="flex w-full items-center gap-2 text-left"
          >
            <Icon name={def.icon} className="size-3.5 shrink-0" style={{ color: def.color }} />
            <span className="w-16 shrink-0 text-[11px]">{def.label}</span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted">
              <span
                className="block h-full rounded-sm"
                style={{ width: `${(count / Math.max(1, cards.length)) * 100}%`, background: def.color }}
              />
            </span>
            <span className="w-6 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{count}</span>
          </button>
        ))}
        {stats.length === 0 && <div className="text-[11px] text-muted-foreground">还没有卡片</div>}
      </div>
    </section>
  );
}

/** 最近编辑 */
export function RecentCards() {
  const cards = useStore((s) => s.cards);
  const openCard = useOpenCard();
  const recent = [...cards].sort((a, b) => b.updated_at - a.updated_at).slice(0, 6);

  return (
    <section className="rounded-lg border border-border p-3">
      <SectionTitle>
        <span className="flex items-center gap-1">
          <CalendarClock className="size-3" /> 最近编辑
        </span>
      </SectionTitle>
      <div className="space-y-0.5">
        {recent.map((card) => {
          const def = listCardTypes().find((d) => d.type === card.type);
          return (
            <button
              key={card.id}
              onClick={() => openCard(card.id)}
              className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs hover:bg-accent"
            >
              <Icon name={def?.icon ?? 'Boxes'} className="size-3.5 shrink-0" style={{ color: def?.color }} />
              <span className="min-w-0 flex-1 truncate">{card.title}</span>
              {card.pinned === 1 && <Star className="size-3 fill-amber-400 text-amber-400" />}
              <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(card.updated_at)}</span>
            </button>
          );
        })}
        {recent.length === 0 && <div className="text-[11px] text-muted-foreground">还没有卡片</div>}
      </div>
    </section>
  );
}

/** 底层逻辑速览 */
export function LoreOverview() {
  // 同 MapOverview：selector 只取原始数组，filter 放进 useMemo，
  // 否则每次渲染都产生新数组引用，触发无限重渲染。
  const cards = useStore((s) => s.cards);
  const loreCards = useMemo(() => cards.filter((c) => c.type === 'lore'), [cards]);
  const openCard = useOpenCard();

  return (
    <section className="rounded-lg border border-border p-3">
      <SectionTitle>
        <span className="flex items-center gap-1">
          <Atom className="size-3" /> 底层逻辑
        </span>
      </SectionTitle>
      {loreCards.length === 0 ? (
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          还没有「底层逻辑」卡片。建议先写清楚这个世界最根本的规则（魔法、关键物质、科技极限…），
          它会决定后面所有设定的边界。
        </div>
      ) : (
        <div className="space-y-1">
          {loreCards.map((card) => (
            <button
              key={card.id}
              onClick={() => openCard(card.id)}
              className="block w-full rounded border border-border/60 px-2 py-1.5 text-left hover:bg-accent"
            >
              <div className="truncate text-xs font-medium">{card.title}</div>
              <div className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                {card.summary || '（还没有摘要）'}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** 待补充清单（体检表） */
export function TodoOverview() {
  const cards = useStore((s) => s.cards);
  const relations = useStore((s) => s.relations);
  const outlineNodes = useStore((s) => s.outlineNodes);
  const openCard = useOpenCard();

  const noSummary = cards.filter((c) => !c.summary.trim());
  const noBody = cards.filter((c) => !c.body.trim());
  const orphan = cards.filter((c) => !relations.some((r) => r.from_id === c.id || r.to_id === c.id));
  const total = noSummary.length + noBody.length + orphan.length;

  const Row = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );

  return (
    <section className="rounded-lg border border-border p-3">
      <SectionTitle>
        <span className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="size-3" /> 待补充（{total}）
        </span>
      </SectionTitle>
      <div className="space-y-1 text-[11px]">
        <Row label="缺少摘要" value={noSummary.length} />
        <Row label="没有正文" value={noBody.length} />
        <Row label="孤立卡片（无任何关联）" value={orphan.length} />
        {orphan.length > 0 && (
          <div className="mt-1 space-y-0.5 border-t border-border pt-1">
            {orphan.slice(0, 5).map((card) => (
              <button
                key={card.id}
                onClick={() => openCard(card.id)}
                className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                · {card.title}
              </button>
            ))}
          </div>
        )}
        {outlineNodes.length > 0 && (
          <div className="mt-1 border-t border-border pt-1 text-muted-foreground">
            大纲节点 {outlineNodes.length} 个，已完成 {outlineNodes.filter((n) => n.status === 'done').length} 个
          </div>
        )}
      </div>
    </section>
  );
}
