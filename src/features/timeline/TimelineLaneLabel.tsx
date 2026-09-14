/**
 * 时间轴左侧的泳道名称列（固定在滚动容器左边）
 * ------------------------------------------------------------------
 * 用 `position: sticky; left: 0` 钉住：它就在横向滚动容器**里面**，
 * 所以纵向滚动时与泳道内容天然同步，横向滚动时自己不动 ——
 * 「拖着看时间的时候，这条是什么永远看得见」。
 *
 * 之前的做法是把名称列放在滚动容器外面（另一个 flex 子项），
 * 结果是纵向要滚两遍（名称列滚一次、内容滚一次），稍有出入就错位；
 * 而且刻度尺还得自己留一段左边距来对齐，等于把同一个坐标算了两遍。
 *
 * 显隐开关就放在名称旁边（用户要求：不要收进"泳道与纪元"弹窗里）：
 * 隐藏的泳道仍然留在列表里（否则就再也点不回来了），只是内容变淡。
 */
import { Eye, EyeOff } from 'lucide-react';
import type { Card, TimelineEntry, Track } from '@/types';
import { ageAt } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  track: Track;
  entries: TimelineEntry[];
  cards: Card[];
  cursor: number | null;
  active: boolean;
  /** 名称列的宽度（与常量 LABEL_COL / LABEL_COL_NARROW 一致） */
  width: number;
  onClick: () => void;
  onToggleHidden: () => void;
}

export function TimelineLaneLabel({
  track, entries, cards, cursor, active, width, onClick, onToggleHidden,
}: Props) {
  /** 角色泳道的年龄推算：取该泳道第一条绑定角色卡 */
  const character = track.kind === 'character'
    ? cards.find((c) => c.id === entries.find((e) => e.card_id)?.card_id)
    : undefined;
  const birth = character ? Number(character.fields?.birth_t) : NaN;
  const age = cursor !== null && Number.isFinite(birth) ? ageAt(birth, cursor) : null;
  const hidden = track.hidden === 1;

  return (
    <div
      style={{ height: track.valued ? 56 : 40, width }}
      className={cn(
        'sticky left-0 z-20 flex shrink-0 items-center gap-1 border-b border-r border-border px-1.5',
        active ? 'bg-primary/10' : 'bg-card/80 hover:bg-accent/40',
        hidden && 'opacity-60',
      )}
    >
      <button
        onClick={onClick}
        title={`${track.name}（点击后滚动到该泳道第一个条目）`}
        className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-left"
      >
        <span className="flex items-center gap-1.5 truncate text-[11px] font-medium">
          <span className="size-2 shrink-0 rounded-sm" style={{ background: track.color }} />
          <span className="truncate">{track.name}</span>
        </span>
        {track.kind === 'character' && (
          <span className="truncate text-[10px] text-muted-foreground">
            {age !== null ? `游标时 ${age} 岁` : character ? '未填出生刻度' : '未绑定角色卡'}
          </span>
        )}
        {track.valued === 1 && track.kind !== 'character' && (
          <span className="text-[10px] text-muted-foreground">数值型泳道</span>
        )}
      </button>

      {/* 显隐开关：就在这条泳道旁边，一眼能看到"哪条被我藏了" */}
      <button
        onClick={onToggleHidden}
        title={hidden ? '显示这条泳道' : '隐藏这条泳道'}
        aria-label={hidden ? '显示这条泳道' : '隐藏这条泳道'}
        className={cn(
          'shrink-0 rounded p-0.5 hover:bg-accent hover:text-foreground max-md:p-1',
          hidden ? 'text-muted-foreground' : 'text-muted-foreground/50',
        )}
      >
        {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}
