/**
 * 双链引用候选弹层
 * ------------------------------------------------------------------
 * 在编辑器里输入 `[[` 时弹出，回车即把 `[[标题]]` 插入正文。
 * 这是「零切换写作」的核心：不用离开键盘去翻卡片库。
 */
import { Sparkles } from 'lucide-react';
import type { Card } from '@/types';
import { getCardType } from '@/lib/plugin/registry';
import { Icon } from '@/components/Icon';

interface Props {
  candidates: Card[];
  query: string;
  onPick: (title: string) => void;
  /** 无匹配时是否显示「回车即时创建」提示 */
  onCreate?: (title: string) => void;
}

export function WikiSuggestPopup({ candidates, query, onPick, onCreate }: Props) {
  const trimmed = query.trim();
  if (candidates.length === 0 && !trimmed) return null;

  return (
    <div className="absolute bottom-2 left-2 z-40 w-80 overflow-hidden rounded-md border border-border bg-popover shadow-xl">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1 text-[10px] text-muted-foreground">
        <Sparkles className="size-3" />
        插入设定卡引用
        <span className="ml-auto">↑↓ 选择 · Enter 确认 · Esc 取消</span>
      </div>

      {candidates.map((card, index) => {
        const def = getCardType(card.type);
        return (
          <button
            key={card.id}
            onClick={() => onPick(card.title)}
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent ${
              index === 0 ? 'bg-accent/60' : ''
            }`}
          >
            <Icon name={def.icon} className="size-3.5 shrink-0" style={{ color: def.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{card.title}</span>
              {card.summary && (
                <span className="block truncate text-[10px] text-muted-foreground">{card.summary}</span>
              )}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{def.label}</span>
          </button>
        );
      })}

      {candidates.length === 0 && trimmed && (
        <div className="px-2 py-2 text-[11px] text-muted-foreground">
          没有匹配的卡片
          {onCreate && (
            <button onClick={() => onCreate(trimmed)} className="ml-1 text-primary hover:underline">
              新建「{trimmed}」
            </button>
          )}
        </div>
      )}
    </div>
  );
}
