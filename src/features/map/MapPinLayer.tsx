/**
 * 地图标记层
 * ------------------------------------------------------------------
 * 用 HTML 而不是 SVG 画标记点：这样可以直接放 emoji、用 Tailwind 做
 * hover 缩放，并且拖拽时不必处理 SVG 坐标变换。
 */
import type { MapPin } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  pins: MapPin[];
  selectedPinId: string | null;
  showLabels: boolean;
  onSelect: (pinId: string) => void;
  onDragStart: (pinId: string) => void;
}

export function MapPinLayer({ pins, selectedPinId, showLabels, onSelect, onDragStart }: Props) {
  return (
    <>
      {pins.map((pin) => {
        const active = pin.id === selectedPinId;
        return (
          <button
            key={pin.id}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 select-none rounded-full text-center transition-transform',
              active ? 'z-20 scale-125' : 'z-10 hover:scale-110',
            )}
            style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            title={`${pin.label}${pin.note ? `\n${pin.note}` : ''}`}
            onPointerDown={(e) => {
              // 阻止冒泡：否则会被画布当成「空白点击」而新建标记
              e.stopPropagation();
              onDragStart(pin.id);
              onSelect(pin.id);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="flex size-6 items-center justify-center rounded-full border-2 text-xs shadow-lg"
              style={{ borderColor: pin.color, background: 'hsl(var(--card))' }}
            >
              {pin.icon}
            </span>
            {showLabels && (
              <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-background/85 px-1 text-[10px] text-foreground shadow">
                {pin.label}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
