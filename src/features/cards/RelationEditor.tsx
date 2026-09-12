/**
 * 关联编辑器
 * ------------------------------------------------------------------
 * 需求 1：卡片之间自由互相关联，关系名称完全自定义（师徒 / 隶属 / 导致…）。
 * 双向反查：别人指向我的关系也会显示出来，并标明方向。
 */
import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Link2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { relationsOfCard } from '@/lib/query';
import { RELATION_SUGGESTIONS } from '@/types';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { CardPicker } from './CardPicker';

/** 单条关联 */
function RelationRow({
  relationId,
  currentCardId,
}: {
  relationId: string;
  currentCardId: string;
}) {
  const relation = useStore((s) => s.relations.find((r) => r.id === relationId));
  const otherId = relation ? (relation.from_id === currentCardId ? relation.to_id : relation.from_id) : null;
  const card = useStore((s) => (otherId ? s.cards.find((c) => c.id === otherId) : undefined));
  const updateRelation = useStore((s) => s.updateRelation);
  const deleteRelation = useStore((s) => s.deleteRelation);
  const selectCard = useStore((s) => s.selectCard);

  if (!relation) return null;
  const outgoing = relation.from_id === currentCardId;
  const def = card ? getCardType(card.type) : null;

  return (
    <div className="group flex items-center gap-1.5 rounded px-1 py-1 hover:bg-accent/60">
      {outgoing ? (
        <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" />
      ) : (
        <ArrowDownLeft className="size-3 shrink-0 text-emerald-400" />
      )}
      <input
        value={relation.label}
        onChange={(e) => updateRelation(relation.id, { label: e.target.value })}
        placeholder="关系名称"
        className="w-20 shrink-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-muted-foreground hover:border-border focus:border-border focus:outline-none"
      />
      <button
        onClick={() => card && selectCard(card.id)}
        className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs hover:text-primary"
      >
        {def && <Icon name={def.icon} className="size-3 shrink-0" style={{ color: def.color }} />}
        <span className="truncate">{card?.title ?? '（已删除的卡片）'}</span>
      </button>
      <button
        onClick={() => deleteRelation(relation.id)}
        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

/** 关联区 */
export function RelationEditor({ cardId }: { cardId: string }) {
  const relations = useStore((s) => s.relations);
  const addRelation = useStore((s) => s.addRelation);
  const [picking, setPicking] = useState(false);
  const [label, setLabel] = useState('');

  const edges = useMemo(() => relationsOfCard(cardId, relations), [cardId, relations]);
  const outgoing = edges.filter((e) => e.direction === 'outgoing');
  const incoming = edges.filter((e) => e.direction === 'incoming');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="关系名称（可自由填写，如「师父」）"
          className="h-7 text-xs"
          list="relation-suggestions"
        />
        <datalist id="relation-suggestions">
          {RELATION_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Button size="sm" className="h-7 shrink-0 gap-1" onClick={() => setPicking(true)}>
          <Plus className="size-3" /> 关联
        </Button>
      </div>

      {edges.length === 0 && (
        <div className="px-1 py-2 text-[11px] text-muted-foreground">
          还没有关联。试试把角色关联到地点、事件或参考资料。
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ArrowUpRight className="size-3" /> 指向（本卡 → 其它）
          </div>
          {outgoing.map((e) => (
            <RelationRow key={e.id} relationId={e.id} currentCardId={cardId} />
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ArrowDownLeft className="size-3" /> 被指向（其它 → 本卡）
          </div>
          {incoming.map((e) => (
            <RelationRow key={e.id} relationId={e.id} currentCardId={cardId} />
          ))}
        </div>
      )}

      <CardPicker
        open={picking}
        onOpenChange={setPicking}
        excludeIds={[cardId]}
        title="关联到哪张卡片？"
        onSelect={(targetId) => {
          addRelation({ from_id: cardId, to_id: targetId, label: label.trim() || '相关' });
          setLabel('');
        }}
      />
    </div>
  );
}

/** 关联数量徽标（列表里用） */
export function RelationCount({ cardId, className }: { cardId: string; className?: string }) {
  const relations = useStore((s) => s.relations);
  const count = useMemo(
    () => relations.filter((r) => r.from_id === cardId || r.to_id === cardId).length,
    [relations, cardId],
  );
  if (count === 0) return null;
  return (
    <Badge variant="outline" className={cn('gap-0.5 border-0 bg-muted text-[10px]', className)}>
      <Link2 className="size-2.5" />
      {count}
    </Badge>
  );
}
