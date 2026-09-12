/**
 * 时间轴条目编辑器
 * ------------------------------------------------------------------
 * 需求 3：事件要能标「什么时候发生、持续多久」，角色要能标
 * 「某时间点的状态」，科技 / 底层设定要能标「发展到什么水平」。
 */
import { useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SectionTitle } from '@/components/ui/primitives';
import { AutoInput, AutoNumber, AutoTextarea } from '@/components/common/AutoField';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { useStore } from '@/store';
import { CardPicker } from '@/features/cards/CardPicker';

export function EntryEditor({ entryId }: { entryId: string }) {
  const entry = useStore((s) => s.entries.find((e) => e.id === entryId));
  const tracks = useStore((s) => s.tracks);
  const maps = useStore((s) => s.maps);
  const updateEntry = useStore((s) => s.updateEntry);
  const deleteEntry = useStore((s) => s.deleteEntry);
  const card = useStore((s) => (entry?.card_id ? s.cards.find((c) => c.id === entry.card_id) : undefined));
  const selectCard = useStore((s) => s.selectCard);
  const [picking, setPicking] = useState(false);
  if (!entry) return null;

  const duration = entry.end_t !== null ? Math.round((entry.end_t - entry.start_t) * 100) / 100 : null;

  return (
    <div className="space-y-2 p-2">
      <div className="space-y-1">
        <Label>条目标题</Label>
        <AutoInput value={entry.title} onCommit={(title) => updateEntry(entry.id, { title })} />
      </div>

      <div className="space-y-1">
        <Label>所属泳道</Label>
        <Select value={entry.track_id} onValueChange={(v) => updateEntry(entry.id, { track_id: v })}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tracks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label>开始刻度</Label>
          <AutoNumber value={entry.start_t} onCommit={(v) => updateEntry(entry.id, { start_t: v ?? 0 })} />
        </div>
        <div className="space-y-1">
          <Label>结束刻度</Label>
          <AutoNumber value={entry.end_t} onCommit={(v) => updateEntry(entry.id, { end_t: v })} placeholder="留空 = 瞬时" />
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Clock className="size-3" />
        {duration === null ? '瞬时事件' : `持续 ${duration} 个刻度单位`}
        {duration !== null && duration < 0 && <span className="text-destructive">（结束早于开始）</span>}
      </div>

      <div className="space-y-1">
        <Label>该时段的状态 / 身份</Label>
        <AutoInput
          value={entry.state}
          onCommit={(state) => updateEntry(entry.id, { state })}
          placeholder="如：骑士团末席（受控）"
        />
      </div>
      <div className="space-y-1">
        <Label>备注</Label>
        <AutoTextarea value={entry.note} onCommit={(note) => updateEntry(entry.id, { note })} minHeight={56} />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label>数值（科技 / 水平）</Label>
          <AutoNumber value={entry.value} onCommit={(v) => updateEntry(entry.id, { value: v })} placeholder="0~100" />
        </div>
        <div className="space-y-1">
          <Label>关联地图</Label>
          <Select
            value={entry.map_id ?? 'none'}
            onValueChange={(v) => updateEntry(entry.id, { map_id: v === 'none' ? null : v })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">（无）</SelectItem>
              {maps.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SectionTitle>关联卡片</SectionTitle>
      {card ? (
        <button
          onClick={() => selectCard(card.id)}
          className="flex w-full items-center gap-1.5 rounded border border-border px-2 py-1.5 text-left text-xs hover:bg-accent"
        >
          <Icon
            name={getCardType(card.type).icon}
            className="size-3.5"
            style={{ color: getCardType(card.type).color }}
          />
          <span className="min-w-0 flex-1 truncate">{card.title}</span>
          <Badge variant="outline" className="border-0 bg-muted text-[10px]">
            {getCardType(card.type).label}
          </Badge>
        </button>
      ) : (
        <div className="text-[11px] text-muted-foreground">未关联卡片</div>
      )}
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setPicking(true)}>
          {card ? '更换卡片' : '关联卡片'}
        </Button>
        {card && (
          <Button variant="ghost" size="sm" onClick={() => updateEntry(entry.id, { card_id: null })}>
            解绑
          </Button>
        )}
      </div>
      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => deleteEntry(entry.id)}>
        <Trash2 className="size-3.5" /> 删除条目
      </Button>

      <CardPicker
        open={picking}
        onOpenChange={setPicking}
        title="关联到哪张卡片？"
        onSelect={(id) => {
          const target = useStore.getState().cards.find((c) => c.id === id);
          updateEntry(entry.id, {
            card_id: id,
            title: entry.title === '新条目' && target ? target.title : entry.title,
          });
        }}
      />
    </div>
  );
}
