/**
 * 详情视图抬头三段（标题 / 副标题 / 摘要）
 * ------------------------------------------------------------------
 * 只在「编辑」与「分栏」两种视图里出现：预览面自带抬头，重复渲染会变两份。
 * 单独成文件是为了让 CardDetailView 留在 200 行以内。
 */
import { AutoInput, AutoTextarea } from '@/components/common/AutoField';
import { useStore } from '@/store';
import type { Card } from '@/types';
import type { CardTypeDef } from '@/types/field';

export function CardHeadFields({ card, def }: { card: Card; def: CardTypeDef }) {
  const updateCard = useStore((s) => s.updateCard);
  return (
    <>
      <AutoInput
        value={card.title}
        onCommit={(title) => updateCard(card.id, { title })}
        placeholder={def.titlePlaceholder ?? '标题'}
        className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
      />
      <AutoInput
        value={card.subtitle}
        onCommit={(subtitle) => updateCard(card.id, { subtitle })}
        placeholder="副标题 / 称号 / 所属"
        className="h-auto border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
      />
      <AutoTextarea
        value={card.summary}
        onCommit={(summary) => updateCard(card.id, { summary })}
        placeholder={`${def.summaryLabel ?? '一句话摘要'}（会显示在卡片列表与悬浮预览里）`}
        className="min-h-[52px] text-xs"
      />
    </>
  );
}
