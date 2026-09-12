/**
 * 卡片瓦片（卡片库网格中的一格）
 * ------------------------------------------------------------------
 * 需求 6：能可视化就尽量可视化 —— 用类型色条、封面缩略图、标签色点
 * 让用户一眼分辨卡片性质，而不是读文字。
 */
import { Pin, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { excerpt } from '@/lib/markdown';
import { cn, relativeTime } from '@/lib/utils';
import { useStore } from '@/store';
import { CoverThumb } from './CardPreview';
import { RelationCount } from './RelationEditor';

export function CardTile({ cardId }: { cardId: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));
  const selected = useStore((s) => s.selectedCardId === cardId);
  const selectCard = useStore((s) => s.selectCard);
  const togglePin = useStore((s) => s.togglePin);
  const tags = useStore((s) => s.tags);
  const cardTags = useStore((s) => s.cardTags);
  const branches = useStore((s) => s.branches);

  if (!card) return null;
  const def = getCardType(card.type);
  const ownedTags = tags.filter((t) => cardTags.some((ct) => ct.card_id === card.id && ct.tag_id === t.id));
  const branch = branches.find((b) => b.id === card.branch_id);

  return (
    <button
      onClick={() => selectCard(card.id)}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-all',
        selected ? 'border-primary shadow-[0_0_0_1px] shadow-primary/40' : 'border-border hover:border-primary/40 hover:shadow-md',
      )}
    >
      {/* 类型色条：一眼分辨卡片性质 */}
      <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: def.color }} />

      {card.cover_asset && <CoverThumb assetId={card.cover_asset} className="h-24 w-full" />}

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5 pl-3">
        <div className="flex items-center gap-1.5">
          <Icon name={def.icon} className="size-3.5 shrink-0" style={{ color: def.color }} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">{card.title}</span>
          {card.pinned === 1 && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />}
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              togglePin(card.id);
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-amber-400 group-hover:opacity-100"
          >
            <Pin className="size-3" />
          </span>
        </div>

        {card.subtitle && <div className="truncate text-[11px] text-muted-foreground">{card.subtitle}</div>}

        <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/70">
          {card.summary || excerpt(card.body, 70) || '（暂无内容）'}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          {branch && (
            <Badge variant="outline" className="border-0 px-1 text-[10px]" style={{ background: `${branch.color}22`, color: branch.color }}>
              {branch.name}
            </Badge>
          )}
          {ownedTags.slice(0, 3).map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded bg-muted px-1 py-0.5 text-[10px]">
              <span className="size-1.5 rounded-full" style={{ background: t.color }} />
              {t.name}
            </span>
          ))}
          {ownedTags.length > 3 && <span className="text-[10px] text-muted-foreground">+{ownedTags.length - 3}</span>}
          <span className="ml-auto flex items-center gap-1">
            <RelationCount cardId={card.id} />
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground/70">{relativeTime(card.updated_at)}</div>
      </div>
    </button>
  );
}
