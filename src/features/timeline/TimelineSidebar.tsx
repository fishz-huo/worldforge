/**
 * 时间轴侧栏
 * ------------------------------------------------------------------
 * 泳道管理、纪元分段（EraList）、时间单位配置，
 * 以及「从卡片直接生成条目」——这是把设定层与时间轴连起来的最快路径。
 */
import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SectionTitle } from '@/components/ui/primitives';
import { SidePanel } from '@/components/layout/Panel';
import { DEFAULT_TIME_CONFIG, TRACK_KINDS, type TimeConfig, type TrackKind } from '@/types';
import { useStore } from '@/store';
import { CardPicker } from '@/features/cards/CardPicker';
import { EraList } from './EraList';

export function TimelineSidebar({ onFit }: { onFit: () => void }) {
  const tracks = useStore((s) => s.tracks);
  const entries = useStore((s) => s.entries);
  const createTrack = useStore((s) => s.createTrack);
  const updateTrack = useStore((s) => s.updateTrack);
  const deleteTrack = useStore((s) => s.deleteTrack);
  const entryFromCard = useStore((s) => s.entryFromCard);
  const world = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId));
  const updateWorld = useStore((s) => s.updateWorld);

  const [trackName, setTrackName] = useState('');
  const [kind, setKind] = useState<TrackKind>('event');
  const [picking, setPicking] = useState(false);
  const time = world?.meta?.time;

  /** 修改时间单位等配置（写进 world.meta.time，缺字段用默认值补齐） */
  const patchTime = (patch: Partial<TimeConfig>) => {
    if (!world) return;
    const current: TimeConfig = { ...DEFAULT_TIME_CONFIG, ...(time ?? {}) };
    updateWorld(world.id, { meta: { ...world.meta, time: { ...current, ...patch } } });
  };

  return (
    <SidePanel title="时间轴">
      <div className="space-y-3 p-2">
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={onFit}>
            适配全部条目
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => setPicking(true)}>
            <Wand2 className="size-3" /> 从卡片生成
          </Button>
        </div>

        <SectionTitle>泳道（{tracks.length}）</SectionTitle>
        <div className="space-y-0.5">
          {tracks.map((t) => (
            <div key={t.id} className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-accent/60">
              <button
                onClick={() => updateTrack(t.id, { hidden: t.hidden === 1 ? 0 : 1 })}
                title={t.hidden === 1 ? '显示该泳道' : '隐藏该泳道'}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {t.hidden === 1 ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <input
                type="color"
                value={t.color}
                onChange={(e) => updateTrack(t.id, { color: e.target.value })}
                title="泳道颜色"
                className="size-4 shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0"
              />
              <input
                value={t.name}
                onChange={(e) => updateTrack(t.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-border focus:border-border focus:outline-none"
              />
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {entries.filter((e) => e.track_id === t.id).length}
              </span>
              <button
                onClick={() => {
                  const count = entries.filter((e) => e.track_id === t.id).length;
                  if (confirm(`删除泳道「${t.name}」及其 ${count} 个条目？`)) deleteTrack(t.id);
                }}
                title="删除泳道"
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-1">
          <Input
            value={trackName}
            onChange={(e) => setTrackName(e.target.value)}
            placeholder="新泳道名称"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trackName.trim()) {
                createTrack(trackName.trim(), kind);
                setTrackName('');
              }
            }}
          />
          <Select value={kind} onValueChange={(v) => setKind(v as TrackKind)}>
            <SelectTrigger className="h-7 w-24 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRACK_KINDS.map((k) => (
                <SelectItem key={k.kind} value={k.kind}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon-sm"
            disabled={!trackName.trim()}
            onClick={() => {
              createTrack(trackName.trim(), kind);
              setTrackName('');
            }}
          >
            <Plus />
          </Button>
        </div>
        <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
          {TRACK_KINDS.find((k) => k.kind === kind)?.hint}
        </p>

        <EraList />

        <SectionTitle>时间单位</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5 px-1">
          <div className="space-y-1">
            <Label>单位名</Label>
            <Input
              defaultValue={time?.unit ?? '年'}
              onBlur={(e) => patchTime({ unit: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label>零点称呼</Label>
            <Input
              defaultValue={time?.zeroLabel ?? '纪元元年'}
              onBlur={(e) => patchTime({ zeroLabel: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
        </div>
        <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
          刻度是纯数值（可为负数），显示时套用上面的单位名，例如 245 →「245 年」。
        </p>
      </div>

      <CardPicker
        open={picking}
        onOpenChange={setPicking}
        title="用哪张卡片生成时间轴条目？"
        types={['event', 'character', 'faction', 'location']}
        onSelect={(cardId) => {
          const track = tracks.find((t) => t.kind === 'event') ?? tracks[0];
          if (!track) {
            useStore.getState().toast('请先创建一条泳道', 'warn');
            return;
          }
          entryFromCard(cardId, track.id);
        }}
      />
    </SidePanel>
  );
}
