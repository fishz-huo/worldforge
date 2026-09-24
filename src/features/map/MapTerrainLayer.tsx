/**
 * 地形符号层（世界层里的符号本体）
 * ==================================================================
 * 与图钉层（MapPinLayer）刻意不同的一点：**符号随底图缩放**。
 *   图钉是"点位"，放大后仍然只有 24px 才有意义；
 *   地形是"面/纹理"（山脉、森林、沼泽），放大时要跟着铺开 —— 否则密排的
 *   沼泽缩到 6 倍还是一小撮横线，看着不像地形。
 * 所以宽度用**世界层的百分比**（底图宽的 6% × size），高度由 aspect-ratio
 * 推出来：宽高都是世界像素，方向与比例都跟着底图走，放大也不会糊。
 *
 * 让路的两条（与图钉同一套口径）：
 *   - 平移态（平移工具 / 按住空格 / 中键）→ 整层不接收指针，把这一下让给画布；
 *   - 地形笔刷激活 → 同样让路，于是"连点成片"时点下去落的永远是新符号，
 *     而不是把压在下面的旧符号选中/拖走。
 */
import type { MapPin } from '@/types';
import { cn } from '@/lib/utils';
import { isPanPress } from './mapPan';
import type { MapViewMode } from './mapRender';
import { TERRAIN_BASE_RATIO, readTerrain } from './mapTerrain';
import { TerrainGlyph } from './TerrainGlyph';

interface Props {
  terrain: MapPin[];
  selectedTerrainId: string | null;
  viewMode: MapViewMode;
  /** 平移态：这一层让路给画布 */
  panMode: boolean;
  /** 笔刷激活：让点击穿到画布上落新符号 */
  brushActive: boolean;
  onSelect: (pinId: string) => void;
  /** 传进来的是"按下即返回处理器"的柯里化函数（与区域整体移动同一套） */
  onDragStart: (pin: MapPin) => (e: React.PointerEvent) => void;
}

export function MapTerrainLayer({
  terrain, selectedTerrainId, viewMode, panMode, brushActive, onSelect, onDragStart,
}: Props) {
  const yields = panMode || brushActive;

  return (
    <>
      {terrain.map((pin) => {
        const meta = readTerrain(pin);
        // 不是地形（手改过的 JSON）就不画：宁可少一个符号，也别画成奇怪的东西
        if (!meta) return null;
        const active = pin.id === selectedTerrainId;
        return (
          <button
            key={pin.id}
            type="button"
            data-wf-map-terrain={pin.id}
            title={`${pin.label}｜${meta.size.toFixed(2)}× ｜${meta.rotation}°\n拖动可移动；选中后用右下角方块缩放、上方圆点旋转`}
            style={{
              left: `${pin.x * 100}%`,
              top: `${pin.y * 100}%`,
              // 宽度是世界层宽度的百分比 → 符号随底图缩放（这是本轮的选择）
              width: `${TERRAIN_BASE_RATIO * meta.size * 100}%`,
              aspectRatio: '1 / 1',
              color: pin.color,
              transform: `translate(-50%, -50%) rotate(${meta.rotation}deg)`,
            }}
            className={cn(
              'absolute select-none',
              yields && 'pointer-events-none',
              active ? 'z-[6]' : 'z-[5]',
            )}
            onPointerDown={(e) => {
              // 平移优先：中键任何模式、左键在平移态 —— 不拦这一下，交给画布
              if (isPanPress(e.button, panMode) || e.button !== 0) return;
              // 拦下来：否则会被画布当成"点空白"，顺手把选中取消了
              e.stopPropagation();
              onSelect(pin.id);
              // 预览只选中（拖动的每次 pointermove 都会写库）
              if (viewMode === 'edit') onDragStart(pin)(e);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <TerrainGlyph symbol={meta.symbol} className="h-full w-full" />

            {/* 选中的虚线框只在编辑模式出现（预览模式下它属于"编辑痕迹"） */}
            {active && viewMode === 'edit' && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 border border-dashed"
                style={{ borderColor: pin.color }}
              />
            )}
          </button>
        );
      })}
    </>
  );
}
