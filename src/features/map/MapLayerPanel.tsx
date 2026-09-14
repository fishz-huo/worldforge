/**
 * 地图图层面板
 * ------------------------------------------------------------------
 * 像绘画软件那样管理底图：新建、显隐、调不透明度、上下移、删除（每一行的
 * 具体控件见 MapLayerRow）。列表**自上而下 = 从上层到下层**，与绘画软件一致，
 * 而渲染是从下往上画，所以这里把数组反转一次再显示。
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { sortLayers } from '@/types';
import { useStore } from '@/store';
import { MapLayerRow } from './MapLayerRow';
export function MapLayerPanel({ mapId }: { mapId: string }) {
  const layers = useStore((s) => s.layers);
  const pins = useStore((s) => s.pins);
  const regions = useStore((s) => s.regions);
  const addLayer = useStore((s) => s.addLayer);
  const mine = sortLayers(layers.filter((l) => l.map_id === mapId)).reverse(); // 上层在上
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <SectionTitle>图层（{mine.length}）</SectionTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          title="新建图层"
          className="ml-auto"
          onClick={() => addLayer(mapId)}
        >
          <Plus />
        </Button>
        <button onClick={() => setOpen(!open)} className="text-[10px] text-muted-foreground hover:text-foreground">
          {open ? '收起' : '展开'}
        </button>
      </div>

      {open && (
        <div className="space-y-1">
          {mine.length === 0 && (
            <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
              还没有图层。新建一层再传图，就能把地形、注记、势力范围分成多层分别调暗调亮。
            </p>
          )}
          {mine.map((layer, i) => (
            <MapLayerRow
              key={layer.id}
              layer={layer}
              isTop={i === 0}
              isBottom={i === mine.length - 1}
              count={
                pins.filter((p) => p.layer_id === layer.id).length
                + regions.filter((r) => r.layer_id === layer.id).length
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

