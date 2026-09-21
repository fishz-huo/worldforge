/**
 * 卡片预览面（详情视图复用块）
 * ------------------------------------------------------------------
 * 卡片详情视图有两个地方要看同一张「渲染出来的卡片页面」：
 * 「预览」页签（单栏全宽）与「分栏」页签的右栏。
 *
 * 渲染逻辑（双链点击、空正文提示）将来一定会改，复制两份必然分叉，
 * 所以抽成这个文件共用；与 CardPreview.tsx（悬浮预览卡 / 封面缩略图）
 * 是两回事，互不影响。
 */
import { MarkdownView } from '@/components/common/MarkdownView';
import { cn } from '@/lib/utils';
import type { Card } from '@/types';

export function CardPreviewPane({
  card,
  onCardClick,
  className,
}: {
  card: Card;
  /** 点正文里的双链时跳转 —— 由父组件决定跳到哪（详情视图里就是打开那张卡） */
  onCardClick?: (cardId: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2 rounded-lg border border-border p-3', className)}>
      {/* 抬头直接读渲染值，这样预览就是一张从顶部长起的「卡片页面」 */}
      <div className="space-y-0.5">
        <h1 className="text-xl font-semibold leading-tight">{card.title || '（无标题）'}</h1>
        {card.subtitle && <div className="text-xs text-muted-foreground">{card.subtitle}</div>}
        {card.summary && (
          <p className="text-xs leading-relaxed text-muted-foreground">{card.summary}</p>
        )}
      </div>
      <div className="border-t border-border pt-2">
        {card.body.trim() ? (
          <MarkdownView text={card.body} onCardClick={onCardClick} />
        ) : (
          <div className="text-xs text-muted-foreground">正文还是空的。</div>
        )}
      </div>
    </div>
  );
}
