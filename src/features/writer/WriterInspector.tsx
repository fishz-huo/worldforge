/**
 * 写作层检查器：实时相关设定卡片
 * ------------------------------------------------------------------
 * 需求 6「零切换写作」的关键：
 *  - 随着正文变化，自动识别文中提到的卡片（标题命中）与 [[双链]]；
 *  - 列出这些卡片的摘要，鼠标悬停即可弹出完整预览，不必离开写作界面；
 *  - 同时给出「尚未创建的双链」，提示可以顺手补一张卡片。
 */
import { useMemo, useState } from 'react';
import { Link2, ListTree, Plus, Sparkles, Unlink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionTitle } from '@/components/ui/primitives';
import { Icon } from '@/components/Icon';
import { InspectorPanel } from '@/components/layout/Panel';
import { getCardType } from '@/lib/plugin/registry';
import { excerpt, extractHeadings } from '@/lib/markdown';
import { extractWikiTargets } from '@/lib/markdown/inline';
import { buildTitleIndex, findMentionedCards } from '@/lib/query';
import { countWords, readingMinutes } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebounced';
import { useStore } from '@/store';
import { WikiHoverCard } from '@/features/cards/CardPreview';

/** 相关卡片列表（悬停显示预览） */
export function RelatedCardsPanel({ text }: { text: string }) {
  const cards = useStore((s) => s.cards);
  const selectCard = useStore((s) => s.selectCard);
  const setModule = useStore((s) => s.setModule);
  const createCard = useStore((s) => s.createCard);
  const [hoverId, setHoverId] = useState<string | null>(null);

  /** 去抖：避免每敲一个字就重算整篇的相关卡片 */
  const debounced = useDebouncedValue(text, 400);
  const index = useMemo(() => buildTitleIndex(cards), [cards]);

  const mentioned = useMemo(() => findMentionedCards(debounced, cards), [debounced, cards]);
  const linked = useMemo(() => {
    return extractWikiTargets(debounced)
      .map((t) => index.get(t))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [debounced, index]);
  /** 双链指向但还不存在的卡片 */
  const missing = useMemo(() => {
    return [...new Set(extractWikiTargets(debounced))].filter((t) => !index.get(t));
  }, [debounced, index]);

  const all = useMemo(() => {
    const map = new Map(mentioned.map((c) => [c.id, c]));
    linked.forEach((c) => map.set(c.id, c));
    return [...map.values()];
  }, [mentioned, linked]);

  return (
    <div className="space-y-3 p-2">
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 p-2 text-[10px] text-muted-foreground">
        <Sparkles className="size-3 shrink-0 text-primary" />
        写到哪，设定就跟到哪。正文里出现的卡片标题会自动出现在下面。
      </div>

      <section>
        <SectionTitle>
          <span className="flex items-center gap-1">
            <Link2 className="size-3" /> 相关设定（{all.length}）
          </span>
        </SectionTitle>
        {all.length === 0 ? (
          <div className="px-2 text-[11px] text-muted-foreground">
            正文里还没有提到任何卡片。试试输入 <code className="rounded bg-muted px-1">[[</code> 唤起卡片选择。
          </div>
        ) : (
          <div className="space-y-0.5">
            {all.map((card) => {
              const def = getCardType(card.type);
              return (
                <div
                  key={card.id}
                  className="relative"
                  onMouseEnter={() => setHoverId(card.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <button
                    onClick={() => {
                      setModule('cards');
                      selectCard(card.id);
                    }}
                    className="flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <Icon name={def.icon} className="mt-0.5 size-3.5 shrink-0" style={{ color: def.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{card.title}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {card.summary || excerpt(card.body, 40) || def.label}
                      </span>
                    </span>
                    <Badge variant="outline" className="shrink-0 border-0 bg-muted text-[9px]">
                      {def.label}
                    </Badge>
                  </button>
                  {hoverId === card.id && (
                    <div className="absolute right-0 top-full z-50 pt-1">
                      <WikiHoverCard cardId={card.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {missing.length > 0 && (
        <section>
          <SectionTitle>
            <span className="flex items-center gap-1">
              <Unlink className="size-3" /> 待创建的引用（{missing.length}）
            </span>
          </SectionTitle>
          <div className="space-y-0.5">
            {missing.map((title) => (
              <div key={title} className="flex items-center gap-1 px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground line-through">{title}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-[10px]"
                  onClick={() => createCard('concept', { title })}
                >
                  <Plus className="size-3" /> 建卡
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** 写作层检查器 */
export function WriterInspector({ text }: { text: string }) {
  const debounced = useDebouncedValue(text, 400);
  const headings = useMemo(() => extractHeadings(debounced), [debounced]);
  const [showOutline, setShowOutline] = useState(false);

  return (
    <InspectorPanel
      title="相关设定"
      actions={
        <Button
          variant="ghost"
          size="icon-sm"
          title={showOutline ? '显示相关设定' : '显示本篇标题结构'}
          onClick={() => setShowOutline(!showOutline)}
        >
          <ListTree className={cn(showOutline && 'text-primary')} />
        </Button>
      }
    >
      <div className="border-b border-border px-2 py-1.5 text-[10px] text-muted-foreground">
        {countWords(debounced)} 字 · 约 {readingMinutes(debounced)} 分钟 · {headings.length} 个标题
      </div>
      {showOutline ? (
        <div className="space-y-0.5 p-2">
          {headings.length === 0 && <EmptyState title="还没有标题" description="用 # 号写标题，这里会实时生成结构。" />}
          {headings.map((h, i) => (
            <div
              key={`${h.text}-${i}`}
              className="truncate rounded px-2 py-1 text-xs hover:bg-accent"
              style={{ paddingLeft: `${8 + (h.level - 1) * 10}px` }}
            >
              {h.text}
            </div>
          ))}
        </div>
      ) : (
        <RelatedCardsPanel text={text} />
      )}
    </InspectorPanel>
  );
}
