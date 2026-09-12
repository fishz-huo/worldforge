/**
 * 卡片侧栏（详情视图右列）
 * ------------------------------------------------------------------
 * 把「字段 / 标签 / 图库 / 关联」这些结构化编辑集中在一列，
 * 正文编辑留在左侧，形成「内容 + 结构」并排的工作面。
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { CardFields } from './CardFields';
import { CardGallery } from './CardGallery';
import { RelationEditor } from './RelationEditor';
import { TagPicker } from './TagPicker';

/** 可折叠区块 */
export function Collapsible({
  title,
  children,
  defaultOpen = true,
  right,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-border bg-card/50">
      <header className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-1 text-left">
          {open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          <span className="truncate text-xs font-semibold">{title}</span>
        </button>
        {right}
      </header>
      {open && <div className={cn('border-t border-border/60 px-2 py-2')}>{children}</div>}
    </section>
  );
}

/** 详情视图的右列 */
export function CardAside({ cardId }: { cardId: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));
  const cardTags = useStore((s) => s.cardTags);
  const tagIds = cardTags.filter((ct) => ct.card_id === cardId).map((ct) => ct.tag_id);

  if (!card) return null;

  return (
    <div className="space-y-2">
      <Collapsible title="标签">
        <TagPicker cardId={cardId} />
      </Collapsible>

      <Collapsible title="结构化字段">
        <Tabs defaultValue="fields">
          <TabsList className="w-full">
            <TabsTrigger value="fields" className="flex-1">
              编辑
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex-1">
              图库
            </TabsTrigger>
          </TabsList>
          <TabsContent value="fields">
            <CardFields card={card} />
          </TabsContent>
          <TabsContent value="gallery">
            <CardGallery cardId={cardId} />
          </TabsContent>
        </Tabs>
      </Collapsible>

      <Collapsible title="关联关系">
        <RelationEditor cardId={cardId} />
      </Collapsible>

      <div className="px-1 text-[10px] text-muted-foreground">已使用标签 {tagIds.length} 个</div>
    </div>
  );
}
