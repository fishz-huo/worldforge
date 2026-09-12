/**
 * 世界观设置
 * ------------------------------------------------------------------
 * 编辑当前世界观的名称、简介、时间轴口径（单位 / 零点 / 默认区间），
 * 以及平行世界分支的名称与分歧点。
 */
import { GitBranch, Globe2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SectionTitle } from '@/components/ui/primitives';
import { Dot } from '@/components/ui/primitives';
import { DEFAULT_TIME_CONFIG } from '@/types';
import { useStore } from '@/store';

export function WorldSettings() {
  const world = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId));
  const updateWorld = useStore((s) => s.updateWorld);
  const branches = useStore((s) => s.branches);
  const updateBranch = useStore((s) => s.updateBranch);

  if (!world) return <div className="p-3 text-xs text-muted-foreground">未选择世界观</div>;
  const time = { ...DEFAULT_TIME_CONFIG, ...(world.meta?.time ?? {}) };

  const patchTime = (patch: Partial<typeof time>) => {
    updateWorld(world.id, { meta: { ...world.meta, time: { ...time, ...patch } } });
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <SectionTitle>
          <span className="flex items-center gap-1">
            <Globe2 className="size-3" /> 世界观信息
          </span>
        </SectionTitle>
        <div className="space-y-2 px-1">
          <div className="space-y-1">
            <Label>名称</Label>
            <Input defaultValue={world.name} onBlur={(e) => updateWorld(world.id, { name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>一句话简介</Label>
            <Textarea
              defaultValue={world.description}
              className="min-h-[64px]"
              onBlur={(e) => updateWorld(world.id, { description: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>时间轴口径</SectionTitle>
        <div className="grid grid-cols-2 gap-2 px-1">
          <div className="space-y-1">
            <Label>刻度单位名</Label>
            <Input defaultValue={time.unit} onBlur={(e) => patchTime({ unit: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>零点称呼</Label>
            <Input defaultValue={time.zeroLabel} onBlur={(e) => patchTime({ zeroLabel: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>默认起始刻度</Label>
            <Input
              type="number"
              defaultValue={time.defaultStart}
              onBlur={(e) => patchTime({ defaultStart: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>默认结束刻度</Label>
            <Input
              type="number"
              defaultValue={time.defaultEnd}
              onBlur={(e) => patchTime({ defaultEnd: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>年龄换算系数</Label>
            <Input
              type="number"
              step="0.1"
              defaultValue={time.ageFactor}
              onBlur={(e) => patchTime({ ageFactor: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
        <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
          时间轴使用纯数值刻度。如果世界观里「1 年 = 10 个月」，把年龄换算系数设为 0.1 即可。
        </p>
      </section>

      <section className="space-y-2">
        <SectionTitle>
          <span className="flex items-center gap-1">
            <GitBranch className="size-3" /> 平行世界分支（{branches.length}）
          </span>
        </SectionTitle>
        <div className="space-y-2 px-1">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            主世界是所有分支的基准。分支可以有自己的卡片、地图与时间轴（在顶部切到「全部分支」还能一起看）。
          </p>
          {branches.map((b) => (
            <div key={b.id} className="space-y-1.5 rounded-md border border-border p-2">
              <div className="flex items-center gap-1.5">
                <Dot color={b.color} />
                <Input
                  defaultValue={b.name}
                  onBlur={(e) => updateBranch(b.id, { name: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
              <Textarea
                defaultValue={b.divergence}
                placeholder="与主世界的分歧点，例如：第 245 年，主角拒绝点燃灵脉"
                onBlur={(e) => updateBranch(b.id, { divergence: e.target.value })}
                className="min-h-[52px] text-xs"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-1">
                  <Label>分歧刻度</Label>
                  <Input
                    type="number"
                    defaultValue={b.divergence_t ?? ''}
                    onBlur={(e) => updateBranch(b.id, { divergence_t: e.target.value === '' ? null : Number(e.target.value) })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label>分支色</Label>
                  <input
                    type="color"
                    value={b.color}
                    onChange={(e) => updateBranch(b.id, { color: e.target.value })}
                    className="h-7 w-full cursor-pointer rounded border border-border bg-transparent"
                  />
                </div>
              </div>
            </div>
          ))}
          {branches.length === 0 && (
            <div className="text-[11px] text-muted-foreground">
              还没有分支。可以在顶部左侧的世界观切换器里「新建平行世界」或「从当前分支派生」。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
