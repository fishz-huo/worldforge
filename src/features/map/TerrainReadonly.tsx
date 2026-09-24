/**
 * 地形符号只读信息（预览模式专用）
 * ------------------------------------------------------------------
 * 与 MapReadonlyInfo 的约束一致：只渲染文本，没有任何 update / delete 入口，
 * 所以预览模式下地形只能看、改不动（用户要求预览"只显示符号本身"）。
 * Field 与 ColorChip 从 MapReadonlyInfo 复用，样式与标记/区域那张卡完全一致。
 */
import { SectionTitle } from '@/components/ui/primitives';
import { useStore } from '@/store';
import { ColorChip, Field } from './MapReadonlyInfo';
import { readTerrain } from './mapTerrain';
import { TerrainGlyph } from './TerrainGlyph';

export function TerrainReadonly({ pinId }: { pinId: string }) {
  const pin = useStore((s) => s.pins.find((p) => p.id === pinId));
  const meta = pin ? readTerrain(pin) : null;
  if (!pin || !meta) return null;

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center gap-2 rounded border border-border bg-card p-2">
        <span className="flex size-8 shrink-0 items-center justify-center" style={{ color: pin.color }}>
          <TerrainGlyph symbol={meta.symbol} className="size-7" />
        </span>
        <div className="min-w-0 flex-1 text-xs font-medium">{pin.label}</div>
      </div>

      <Field label="符号大小" value={`${meta.size.toFixed(2)}× （底图宽的 ${(meta.size * 6).toFixed(1)}%）`} />
      <Field label="旋转角度" value={`${meta.rotation}°`} />
      <Field label="坐标（0~1）" value={`${pin.x.toFixed(3)} , ${pin.y.toFixed(3)}`} />
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <ColorChip color={pin.color} /> 符号颜色 {pin.color}
      </div>

      <SectionTitle>说明</SectionTitle>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        地形符号是地貌本身（山脉、森林、沼泽…），不绑定卡片。切到编辑模式可以改大小、
        旋转、颜色，也能拖动或删除。
      </p>
    </div>
  );
}
