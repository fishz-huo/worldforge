/**
 * 时间轴左侧的泳道名称列
 * ------------------------------------------------------------------
 * 固定宽度、不跟随横向滚动（与视频剪辑软件一致：拖着看时间的时候，
 * "这条是什么"永远看得见）。
 *
 * 从 TimelineLane 里分出来的原因：名称列与内容区在**两个不同的滚动容器**里
 * （名称列不滚、内容区滚），放在同一个组件里就得靠负 margin 之类的技巧凑，
 * 拆开之后两边各自简单。
 */
import type { Card, TimelineEntry, Track } from '@/types';
import { ageAt } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  track: Track;
  entries: TimelineEntry[];
  cards: Card[];
  cursor: number | null;
  active: boolean;
  onClick: () => void;
}

export function TimelineLaneLabel({ track, entries, cards, cursor, active, onClick }: Props) {
  /** 角色泳道的年龄推算：取该泳道第一条绑定角色卡 */
  const character = track.kind === 'character'
    ? cards.find((c) => c.id === entries.find((e) => e.card_id)?.card_id)
    : undefined;
  const birth = character ? Number(character.fields?.birth_t) : NaN;
  const age = cursor !== null && Number.isFinite(birth) ? ageAt(birth, cursor) : null;

  return (
    <button
      onClick={onClick}
      title={`${track.name}（点击后滚动到该泳道第一个条目）`}
      className={cn(
        'flex w-full flex-col justify-center gap-0.5 border-b border-border/60 px-2 text-left transition-colors',
        active ? 'bg-primary/10' : 'bg-card/40 hover:bg-accent/40',
      )}
      style={{ height: track.valued ? 56 : 40 }}
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
  );
}
