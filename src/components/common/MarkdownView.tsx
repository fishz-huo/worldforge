/**
 * Markdown 渲染视图
 * ------------------------------------------------------------------
 * 需求 6：能可视化就可视化，但保留纯文本编写能力。
 * 除了渲染 Markdown，这里还实现「鼠标悬停关键词 → 弹出设定卡预览」：
 * 渲染时把正文里命中的卡片标题包成 .wiki-link[data-wiki-id]，
 * 这里用事件委托捕获 hover，在光标附近浮出卡片摘要。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { renderMarkdown } from '@/lib/markdown';
import { buildTitleIndex } from '@/lib/query';
import { cn } from '@/lib/utils';
import { useAssetUrlMap } from '@/hooks/useAssetUrl';
import { useStore } from '@/store';
import { WikiHoverCard } from '@/features/cards/CardPreview';

/** 悬浮位置 */
interface HoverState {
  cardId: string;
  x: number;
  y: number;
}

export function MarkdownView({
  text,
  className,
  autoLink = true,
  onCardClick,
}: {
  text: string;
  className?: string;
  /** 是否把正文里出现的卡片标题自动变成可预览链接 */
  autoLink?: boolean;
  onCardClick?: (cardId: string) => void;
}) {
  const cards = useStore((s) => s.cards);
  const [hover, setHover] = useState<HoverState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 标题索引：双链解析与自动关联共用 */
  const index = useMemo(() => buildTitleIndex(cards), [cards]);
  const html = useMemo(
    () => renderMarkdown(text, { index, autoLink }),
    [text, index, autoLink],
  );

  /** 正文里用 `asset:<id>` 引用本地图片，这里把 id 换成 objectURL */
  const assetIds = useMemo(
    () => [...html.matchAll(/src="asset:([^"]+)"/g)].map((m) => m[1]),
    [html],
  );
  const assetUrls = useAssetUrlMap(assetIds);
  const finalHtml = useMemo(
    () =>
      assetIds.length === 0
        ? html
        : html.replace(/src="asset:([^"]+)"/g, (m, id) => (assetUrls[id] ? `src="${assetUrls[id]}"` : m)),
    [html, assetIds, assetUrls],
  );

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => setHover(null), 120);
  }, [cancelHide]);

  const onMouseOver = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-wiki-id]') as HTMLElement | null;
    if (!target) return;
    const cardId = target.dataset.wikiId;
    if (!cardId) return;
    const rect = target.getBoundingClientRect();
    cancelHide();
    setHover({ cardId, x: Math.min(rect.left, window.innerWidth - 340), y: rect.bottom + 6 });
  };

  const onClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-wiki-id]') as HTMLElement | null;
    const cardId = target?.dataset.wikiId;
    if (cardId && onCardClick) {
      e.preventDefault();
      onCardClick(cardId);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div
        className="md-body"
        onMouseOver={onMouseOver}
        onMouseOut={scheduleHide}
        onClick={onClick}
        // 内容由自研解析器生成，已对原始文本做 HTML 转义
        dangerouslySetInnerHTML={{ __html: finalHtml }}
      />
      {hover && (
        <div
          className="fixed z-[70]"
          style={{ left: hover.x, top: hover.y }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <WikiHoverCard cardId={hover.cardId} />
        </div>
      )}
    </div>
  );
}
