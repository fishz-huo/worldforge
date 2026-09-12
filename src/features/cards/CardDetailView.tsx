/**
 * 卡片详情视图
 * ------------------------------------------------------------------
 * 主内容区里的「一页 Wiki」：左边写正文，右边改结构（字段/标签/图库/关联）。
 * 所有输入都是自动保存，符合「设定层不需要点保存」的直觉。
 */
import { useMemo, useState } from 'react';
import {
  ArrowLeft, Copy, Eye, Pencil, Star, Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AutoInput, AutoTextarea } from '@/components/common/AutoField';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { MarkdownView } from '@/components/common/MarkdownView';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { countWords } from '@/lib/markdown';
import { cn, formatTime } from '@/lib/utils';
import { useStore } from '@/store';
import { CardAside } from './CardAside';

export function CardDetailView({ cardId }: { cardId: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));
  const updateCard = useStore((s) => s.updateCard);
  const deleteCard = useStore((s) => s.deleteCard);
  const duplicateCard = useStore((s) => s.duplicateCard);
  const togglePin = useStore((s) => s.togglePin);
  const selectCard = useStore((s) => s.selectCard);
  const branches = useStore((s) => s.branches);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const def = useMemo(() => (card ? getCardType(card.type) : null), [card]);
  if (!card || !def) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        卡片不存在或已被删除
      </div>
    );
  }
  const branch = branches.find((b) => b.id === card.branch_id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 头部：返回 + 类型 + 操作 */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => selectCard(null)}>
          <ArrowLeft className="size-3.5" /> 返回列表
        </Button>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: def.color }}>
          <Icon name={def.icon} className="size-3.5" />
          {def.label}
        </span>
        {branch && (
          <Badge variant="outline" className="border-0 text-[10px]" style={{ background: `${branch.color}22`, color: branch.color }}>
            {branch.name}
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          <Hint label={card.pinned ? '取消置顶' : '置顶'}>
            <Button variant="ghost" size="icon-sm" onClick={() => togglePin(card.id)}>
              <Star className={cn(card.pinned === 1 && 'fill-amber-400 text-amber-400')} />
            </Button>
          </Hint>
          <Hint label="创建副本">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const id = duplicateCard(card.id);
                if (id) selectCard(id);
              }}
            >
              <Copy />
            </Button>
          </Hint>
          <Hint label="删除卡片">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              onClick={() => {
                if (confirm(`删除卡片「${card.title}」？相关关联也会一并移除。`)) {
                  deleteCard(card.id);
                  selectCard(null);
                }
              }}
            >
              <Trash2 />
            </Button>
          </Hint>
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_20rem]">
        {/* 左列：标题 + 摘要 + 正文 */}
        <div className="flex min-h-0 flex-col gap-2 p-3">
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

          <Tabs value={mode} onValueChange={(v) => setMode(v as 'edit' | 'preview')} className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="edit" className="gap-1">
                  <Pencil className="size-3" /> 编辑
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1">
                  <Eye className="size-3" /> 预览
                </TabsTrigger>
              </TabsList>
              <span className="text-[10px] text-muted-foreground">
                {countWords(card.body)} 字 · 更新于 {formatTime(card.updated_at)}
              </span>
            </div>
            <TabsContent value="edit" className="mt-1 flex min-h-[320px] flex-1 flex-col">
              <MarkdownEditor
                value={card.body}
                onChange={(body) => updateCard(card.id, { body })}
                className="rounded-lg border border-border"
                placeholder="写设定正文…支持 Markdown；提到其它卡片标题会自动变成可悬停预览的双链"
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-1 flex-1">
              <div className="rounded-lg border border-border p-3">
                {card.body.trim() ? (
                  <MarkdownView text={card.body} onCardClick={(id) => selectCard(id)} />
                ) : (
                  <div className="text-xs text-muted-foreground">正文还是空的。</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* 右列：结构编辑 */}
        <div className="border-t border-border p-2 lg:border-l lg:border-t-0">
          <CardAside cardId={card.id} />
        </div>
      </div>
    </div>
  );
}
