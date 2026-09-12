/**
 * 地图列表
 * ------------------------------------------------------------------
 * 「同一个世界观可以有多张地图」是需求 2 的关键：
 * 每张地图代表一个时期 / 一条分支，用来看疆域与资源的变化。
 */
import { useState } from 'react';
import { Map as MapIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

export function MapListPanel() {
  const maps = useStore((s) => s.maps);
  const selectedMapId = useStore((s) => s.selectedMapId);
  const selectMap = useStore((s) => s.selectMap);
  const createMap = useStore((s) => s.createMap);
  const deleteMap = useStore((s) => s.deleteMap);
  const [name, setName] = useState('');

  /** 新建地图并清空输入框 */
  const submit = () => {
    if (!name.trim()) return;
    createMap(name.trim());
    setName('');
  };

  return (
    <>
      <div className="space-y-0.5">
        {maps.map((m) => (
          <div
            key={m.id}
            className={cn(
              'group flex items-center gap-1 rounded px-2 py-1.5 text-xs transition-colors',
              m.id === selectedMapId ? 'bg-primary/15 text-primary' : 'hover:bg-accent',
            )}
          >
            <button onClick={() => selectMap(m.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
              <MapIcon className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{m.name}</span>
                {m.period && <span className="block truncate text-[10px] text-muted-foreground">{m.period}</span>}
              </span>
            </button>
            <button
              title="删除地图"
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              onClick={() => {
                if (confirm(`删除地图「${m.name}」？其标记与区域会一并移除。`)) deleteMap(m.id);
              }}
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        {maps.length === 0 && (
          <div className="px-1 py-2 text-[11px] leading-relaxed text-muted-foreground">
            还没有地图。建议为每个重要时期建一张，用来看疆域与资源的变化。
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="新地图名称，如「245 年疆域」"
          className="h-7 text-xs"
        />
        <Button size="icon-sm" disabled={!name.trim()} onClick={submit} title="新建地图">
          <Plus />
        </Button>
      </div>
    </>
  );
}
