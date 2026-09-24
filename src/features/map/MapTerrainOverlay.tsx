/**
 * 地形符号的控制点（选中框的缩放方块 + 旋转圆点）
 * ==================================================================
 * 画在**屏幕空间**的覆盖层里（和区域顶点手柄同一层），不是在符号那一层里：
 *   - 位置用 toScreen 从归一化坐标换算，尺寸是纯像素 —— 天然是正方，
 *     不随缩放变形，屏幕上恒定 24px（用户认可的"像 Google 地图"那套）；
 *   - 两个手柄的角度按符号的 rotation 算，所以它们始终贴在框的**同一个角/正上方**，
 *     转起来是跟手的。
 * 选中框本身画在符号层（MapTerrainLayer）里，因为它要随底图缩放一起变大。
 * 手势（拖动/缩放/旋转）在 useTerrainGestures，这里只管摆放与光标。
 */
import { RotateCw } from 'lucide-react';
import type { MapPin } from '@/types';
import { cn } from '@/lib/utils';
import type { MapViewMode } from './mapRender';
import { readTerrain, rotateOffset } from './mapTerrain';

/** 旋转手柄离框顶边的空隙（屏幕像素） */
const ROTATE_GAP = 18;

interface Props {
  /** 选中的地形符号（没选中就什么都不画） */
  pin: MapPin | null;
  viewMode: MapViewMode;
  /** 平移态：手柄让路给画布（否则按在手柄上就没法平移） */
  panMode: boolean;
  /** 归一化坐标 → 画布内的像素位置 */
  toScreen: (nx: number, ny: number) => [number, number];
  /** size=1 时符号在屏幕上的边长（= 底图宽的 6%） */
  unitPx: number;
  onResizeStart: (pin: MapPin) => (e: React.PointerEvent) => void;
  onRotateStart: (pin: MapPin) => (e: React.PointerEvent) => void;
}

export function MapTerrainOverlay({
  pin, viewMode, panMode, toScreen, unitPx, onResizeStart, onRotateStart,
}: Props) {
  const meta = pin ? readTerrain(pin) : null;
  // 预览模式不显示控制点：那时"编辑痕迹"一律不出现（用户要求只显示符号本身）
  if (!pin || !meta || viewMode !== 'edit') return null;

  const [cx, cy] = toScreen(pin.x, pin.y);
  const edge = unitPx * meta.size;
  // 右下角：拖动改大小；正上方：拖动改角度。都按旋转角转到屏幕坐标上
  const [rx, ry] = rotateOffset(edge / 2, edge / 2, meta.rotation);
  const [tx, ty] = rotateOffset(0, -(edge / 2 + ROTATE_GAP), meta.rotation);
  /** 手柄本体一律 size-6（24px）命中区，视觉只有里面那一小块 */
  const handle = (x: number, y: number) => ({ left: cx + x, top: cy + y });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <button
        type="button"
        data-wf-map-terrain-handle="resize"
        title="拖动缩放（0.5×~3×）"
        aria-label="缩放地形符号"
        onPointerDown={onResizeStart(pin)}
        onClick={(e) => e.stopPropagation()}
        style={handle(rx, ry)}
        className={cn(
          'pointer-events-auto absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-transparent p-0',
          panMode ? 'pointer-events-none cursor-default' : 'cursor-nwse-resize',
        )}
      >
        <span
          className="pointer-events-none block size-3 rounded-[2px] border-[1.5px] bg-white shadow-sm"
          style={{ borderColor: pin.color }}
        />
      </button>

      <button
        type="button"
        data-wf-map-terrain-handle="rotate"
        title="拖动旋转（0°~359°）"
        aria-label="旋转地形符号"
        onPointerDown={onRotateStart(pin)}
        onClick={(e) => e.stopPropagation()}
        style={handle(tx, ty)}
        className={cn(
          'pointer-events-auto absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-transparent p-0',
          panMode ? 'pointer-events-none cursor-default' : 'cursor-grab',
        )}
      >
        <span
          className="pointer-events-none flex size-5 items-center justify-center rounded-full border-[1.5px] bg-white shadow-sm"
          style={{ borderColor: pin.color, color: pin.color }}
        >
          <RotateCw className="size-3" strokeWidth={1.75} />
        </span>
      </button>
    </div>
  );
}
