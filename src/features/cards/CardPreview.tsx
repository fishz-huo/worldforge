/**
 * 卡片悬浮预览
 * ------------------------------------------------------------------
 * 需求：正文编辑器里「鼠标悬停关键词即可预览设定卡」。
 * 也用于卡片网格的 hover 预览与关联列表的速览。
 */
import { useMemo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dot } from '@/components/ui/primitives';
import { Icon } from '@/components/Icon';
import { getCardType, getFieldsFor } from '@/lib/plugin/registry';
import { tagsOfCard } from '@/lib/query';
import { excerpt } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { useStore } from '@/store';

/** 封面缩略图 */
export function CoverThumb({ assetId, className }: { assetId: string | null; className?: string }) {
  const url = useAssetUrl(assetId);
  if (!assetId) return null;
  return url ? (
    <img src={url} alt="" className={cn('object-cover', className)} />
  ) : (
    <div className={cn('flex items-center justify-center bg-muted', className)}>
      <ImageIcon className="size-3 text-muted-foreground" />
    </div>
  );
}

/** 悬浮卡片本体（不含定位） */
export function WikiHoverCard({ cardId, className }: { cardId: string; className?: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));
  const tags = useStore((s) => s.tags);
  const cardTags = useStore((s) => s.cardTags);
  const selectCard = useStore((s) => s.selectCard);
  const setModule = useStore((s) => s.setModule);

  const owned = useMemo(() => (card ? tagsOfCard(card.id, cardTags, tags) : []), [card, cardTags, tags]);
  if (!card) {
    return (
      <div className={cn('w-72 rounded-lg border border-border bg-popover p-3 text-xs text-muted-foreground shadow-xl', className)}>
        这张卡片已被删除
      </div>
    );
  }
  const def = getCardType(card.type);
  const fields = getFieldsFor(card.type).slice(0, 4);

  return (
    <div
      className={cn(
        'w-80 cursor-pointer overflow-hidden rounded-lg border border-border bg-popover shadow-2xl animate-fade-in',
        className,
      )}
      onClick={() => {
        setModule('cards');
        selectCard(card.id);
      }}
    >
      {card.cover_asset && <CoverThumb assetId={card.cover_asset} className="h-24 w-full" />}
      <div className="space-y-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <Icon name={def.icon} className="size-3.5" style={{ color: def.color }} />
          <Badge variant="outline" className="border-0 bg-muted px-1 text-[10px]">
            {def.label}
          </Badge>
          {card.branch_id && <Badge variant="warn" className="text-[10px]">分支设定</Badge>}
        </div>
        <div className="text-sm font-semibold leading-tight">{card.title}</div>
        {card.subtitle && <div className="text-[11px] text-muted-foreground">{card.subtitle}</div>}
        <p className="line-clamp-4 text-[11px] leading-relaxed text-foreground/80">
          {card.summary || excerpt(card.body, 120) || '（暂无摘要）'}
        </p>
        {fields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-border pt-1.5">
            {fields.map((f) => {
              const value = card.fields?.[f.key];
              if (value === undefined || value === null || value === '') return null;
              return (
                <div key={f.key} className="truncate text-[10px]">
                  <span className="text-muted-foreground">{f.label}：</span>
                  <span>{Array.isArray(value) ? value.join('、') : String(value)}</span>
                </div>
              );
            })}
          </div>
        )}
        {owned.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {owned.slice(0, 5).map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded bg-muted px-1 text-[10px]">
                <Dot color={t.color} className="size-1.5" />
                {t.name}
              </span>
            ))}
          </div>
        )}
        <div className="pt-0.5 text-[10px] text-primary/80">点击打开完整卡片 →</div>
      </div>
    </div>
  );
}
