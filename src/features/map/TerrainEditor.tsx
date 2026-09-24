/**
 * 地形符号编辑器（右侧检查器，编辑模式）
 * ------------------------------------------------------------------
 * 选中一个地形符号后出现：换符号、改颜色、调大小与旋转、看坐标、删除。
 *
 * 大小与旋转用**滑块**（和「底图不透明度」同一套控件）：这两个值要边拖边看，
 * 输入框得先失焦才生效，手感差；画布上的方块/圆点手柄是同一件事的直接操作版
 * （两边的写入都走 useMapTerrain.patch，口径一致）。
 *
 * 这里没有「绑定卡片」：地形是地貌本身，不是地点，绑卡片是图钉的事。
 */
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { SectionTitle } from '@/components/ui/primitives';
import { AutoNumber } from '@/components/common/AutoField';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import {
  TERRAIN_SIZE_MAX, TERRAIN_SIZE_MIN, TERRAIN_SIZE_STEP, TERRAIN_SYMBOLS, clampSize, normRotation, readTerrain,
} from './mapTerrain';
import { TerrainGlyph } from './TerrainGlyph';
import { useMapTerrain } from './useMapTerrain';

export function TerrainEditor({ pinId }: { pinId: string }) {
  const pin = useStore((s) => s.pins.find((p) => p.id === pinId));
  const updatePin = useStore((s) => s.updatePin);
  const { patch, changeSymbol, remove } = useMapTerrain();
  const meta = pin ? readTerrain(pin) : null;
  // Hook 都在上面调用完了，这里可以安全地早退（被删掉的那一帧）
  if (!pin || !meta) return null;

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center gap-2 rounded border border-border bg-card p-2">
        <span className="flex size-8 shrink-0 items-center justify-center" style={{ color: pin.color }}>
          <TerrainGlyph symbol={meta.symbol} className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium">{pin.label}</div>
          <div className="text-[10px] text-muted-foreground">
            {meta.size.toFixed(2)}× ｜ {meta.rotation}° ｜ 坐标 {pin.x.toFixed(3)} , {pin.y.toFixed(3)}
          </div>
        </div>
        <input
          type="color"
          title="符号颜色"
          value={pin.color}
          onChange={(e) => updatePin(pin.id, { color: e.target.value })}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
        />
      </div>

      <SectionTitle>换成别的符号</SectionTitle>
      <div className="grid grid-cols-5 gap-1">
        {TERRAIN_SYMBOLS.map((d) => (
          <button
            key={d.key}
            type="button"
            title={d.label}
            onClick={() => changeSymbol(pin, d.key)}
            className={cn(
              'flex h-9 flex-col items-center justify-center gap-0.5 rounded-md border text-[10px]',
              d.key === meta.symbol ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-accent',
            )}
          >
            <TerrainGlyph symbol={d.key} className="size-3.5" />
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <Label>大小 {meta.size.toFixed(2)}×（底图宽的 {meta.size.toFixed(2)} × 6%）</Label>
        <Slider
          value={[meta.size]}
          min={TERRAIN_SIZE_MIN}
          max={TERRAIN_SIZE_MAX}
          step={TERRAIN_SIZE_STEP}
          onValueChange={([v]) => patch(pin, { size: clampSize(v) })}
        />
      </div>

      <div className="space-y-1">
        <Label>旋转 {meta.rotation}°</Label>
        <Slider
          value={[meta.rotation]}
          min={0}
          max={359}
          step={1}
          onValueChange={([v]) => patch(pin, { rotation: normRotation(v) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label>X（0~1）</Label>
          <AutoNumber value={pin.x} onCommit={(x) => updatePin(pin.id, { x: x ?? 0 })} />
        </div>
        <div className="space-y-1">
          <Label>Y（0~1）</Label>
          <AutoNumber value={pin.y} onCommit={(y) => updatePin(pin.id, { y: y ?? 0 })} />
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        画布上：拖动符号移动；选中后右下角方块改大小、上方圆点改角度。
      </p>

      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => remove(pin.id)}>
        <Trash2 className="size-3.5" /> 删除这个符号
      </Button>
    </div>
  );
}
