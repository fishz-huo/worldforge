/**
 * 纪元分段列表
 * ------------------------------------------------------------------
 * 纪元 = 时间轴上的背景色带，用来表达「余烬时代」「灵息战争」这类大分期。
 * 从 TimelineSidebar 拆出来，让侧栏专注于泳道管理。
 */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionTitle } from '@/components/ui/primitives';
import { useStore } from '@/store';

export function EraList() {
  const eras = useStore((s) => s.eras);
  const createEra = useStore((s) => s.createEra);
  const updateEra = useStore((s) => s.updateEra);
  const deleteEra = useStore((s) => s.deleteEra);

  return (
    <>
      <SectionTitle
        right={
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px]" onClick={() => createEra('新纪元')}>
            <Plus className="size-3" /> 纪元
          </Button>
        }
      >
        纪元分段
      </SectionTitle>

      <div className="space-y-1">
        {eras.map((era) => (
          <div key={era.id} className="space-y-1 rounded border border-border p-1.5">
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={era.color}
                onChange={(e) => updateEra(era.id, { color: e.target.value })}
                title="纪元色"
                className="size-4 shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0"
              />
              <Input
                defaultValue={era.name}
                onBlur={(e) => updateEra(era.id, { name: e.target.value })}
                className="h-6 min-w-0 flex-1 text-[11px]"
              />
              <button
                onClick={() => deleteEra(era.id)}
                title="删除纪元"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                defaultValue={era.start_t}
                onBlur={(e) => updateEra(era.id, { start_t: Number(e.target.value) })}
                className="h-6 text-[11px]"
              />
              <span className="text-[10px] text-muted-foreground">→</span>
              <Input
                type="number"
                defaultValue={era.end_t}
                onBlur={(e) => updateEra(era.id, { end_t: Number(e.target.value) })}
                className="h-6 text-[11px]"
              />
            </div>
          </div>
        ))}
        {eras.length === 0 && (
          <div className="px-1 text-[11px] text-muted-foreground">
            还没有纪元分段。加上之后，时间轴会用背景色带标出各个大时代。
          </div>
        )}
      </div>
    </>
  );
}
