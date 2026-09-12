/**
 * 当前地图的属性表单
 * ------------------------------------------------------------------
 * 「一张地图 = 一个时期」是这套设计的核心约定：
 * 把时期标签与对应刻度写清楚，时间轴与资源对比才有意义。
 */
import { useRef } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { importImage } from '@/lib/assets';
import type { MapDef } from '@/types';
import { formatTime } from '@/lib/utils';
import { useStore } from '@/store';

export function MapSettingsForm({ map }: { map: MapDef }) {
  const updateMap = useStore((s) => s.updateMap);
  const toast = useStore((s) => s.toast);
  const worldId = useStore((s) => s.currentWorldId);
  const fileRef = useRef<HTMLInputElement>(null);

  /** 上传底图：图片进本地资源库，地图只记 asset_id */
  const uploadBackground = async (file: File) => {
    if (!worldId) return;
    const asset = await importImage(file, worldId);
    updateMap(map.id, { asset_id: asset.id });
    toast('底图已更新', 'success');
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="space-y-1">
        <Label>名称</Label>
        <Input defaultValue={map.name} onBlur={(e) => updateMap(map.id, { name: e.target.value })} className="h-7 text-xs" />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label>时期标签</Label>
          <Input
            defaultValue={map.period}
            placeholder="第三纪元 200 年"
            onBlur={(e) => updateMap(map.id, { period: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label>对应刻度</Label>
          <Input
            type="number"
            defaultValue={map.period_t ?? ''}
            placeholder="可空"
            onBlur={(e) => updateMap(map.id, { period_t: e.target.value === '' ? null : Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>底图</Label>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 gap-1 text-[11px]"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3" /> {map.asset_id ? '更换底图' : '上传底图'}
          </Button>
          {map.asset_id && (
            <Button variant="ghost" size="icon-sm" title="移除底图" onClick={() => updateMap(map.id, { asset_id: null })}>
              <Trash2 />
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadBackground(file);
            e.target.value = '';
          }}
        />
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          没有底图也能用：标记点用归一化坐标，之后补图不会错位。
        </p>
      </div>

      <div className="space-y-1">
        <Label>底图不透明度 {Math.round(map.opacity * 100)}%</Label>
        <Slider
          value={[map.opacity * 100]}
          min={20}
          max={100}
          step={5}
          onValueChange={([v]) => updateMap(map.id, { opacity: v / 100 })}
        />
      </div>

      <div className="text-[10px] text-muted-foreground">更新于 {formatTime(map.updated_at)}</div>
    </div>
  );
}
