/**
 * 详情视图顶部条
 * ------------------------------------------------------------------
 * 从 CardDetailView 拆出来，为了守住「单文件不超过 200 行」。
 * 左边：返回列表 · 类型 · 分支 · 永久编号。
 * 右边那组图标：置顶 · 结构面板开关 · 副本 · 删除 —— 开关按要求放在「置顶」与
 * 「创建副本」之间，所以「返回列表」右侧不再有任何按钮。
 *
 * 开关图标用 PanelRightOpen 而不是 PanelRight：顶栏那个全局「检查器」开关
 * 就是 PanelRight，两个同屏会认错；提示文案也说「结构面板」以示区分。
 */
import { ArrowLeft, Copy, PanelRightOpen, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { Icon } from '@/components/Icon';
import { askConfirm } from '@/lib/confirm';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import type { Card } from '@/types';
import type { CardTypeDef } from '@/types/field';
import { CardCodeBadge } from './CardCodeBadge';

export function CardDetailHeader({
  card,
  def,
  branch,
  asideOpen,
  onToggleAside,
}: {
  card: Card;
  def: CardTypeDef;
  /** 卡片所属的平行世界分支；主世界卡片没有 */
  branch?: { name: string; color: string };
  asideOpen: boolean;
  onToggleAside: () => void;
}) {
  const deleteCard = useStore((s) => s.deleteCard);
  const duplicateCard = useStore((s) => s.duplicateCard);
  const togglePin = useStore((s) => s.togglePin);
  const selectCard = useStore((s) => s.selectCard);

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => selectCard(null)}>
        <ArrowLeft className="size-3.5" /> 返回列表
      </Button>
      <span className="flex items-center gap-1.5 text-xs" style={{ color: def.color }}>
        <Icon name={def.icon} className="size-3.5" />
        {def.label}
      </span>
      {branch && (
        <Badge
          variant="outline"
          className="border-0 text-[10px]"
          style={{ background: `${branch.color}22`, color: branch.color }}
        >
          {branch.name}
        </Badge>
      )}
      <CardCodeBadge cardId={card.id} />

      {/* 右侧操作：置顶 / 结构面板 / 副本 / 删除 */}
      <span className="ml-auto flex items-center gap-0.5">
        <Hint label={card.pinned ? '取消置顶' : '置顶'}>
          <Button variant="ghost" size="icon-sm" onClick={() => togglePin(card.id)}>
            <Star className={cn(card.pinned === 1 && 'fill-amber-400 text-amber-400')} />
          </Button>
        </Hint>
        <Hint label={asideOpen ? '收起结构面板' : '打开结构面板（字段 / 标签 / 图库 / 关联）'}>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(!asideOpen && 'opacity-50')}
            onClick={onToggleAside}
          >
            <PanelRightOpen className="size-3.5" />
          </Button>
        </Hint>
        <Hint label="创建副本">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => { const id = duplicateCard(card.id); if (id) selectCard(id); }}
          >
            <Copy />
          </Button>
        </Hint>
        <Hint label="删除卡片">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            onClick={async () => {
              if (await askConfirm(`删除卡片「${card.title}」？相关关联也会一并移除。`)) {
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
  );
}
