/**
 * 地图标记层
 * ------------------------------------------------------------------
 * 用 HTML 而不是 SVG 画标记点：这样可以直接用 Tailwind 做 hover 缩放，
 * 拖拽时也不必处理 SVG 坐标变换。
 *
 * 视觉对齐设计稿：24px 白底圆 + 1.5px 色边框 + 细线图标（图标见 PinGlyph，
 * 不再直出 emoji）；编辑模式下选中的标记外面套一圈虚线控制圈，表示「可拖动」。
 *
 * 第二批新增两点：
 *   1. `--wf-map-inv-scale` 反向缩放：底图放大到 6 倍时标记不跟着变成巨图
 *      （像 Google 地图：只有地图变大，图钉大小不变）；
 *   2. 预览模式下 hover 高亮并上报浮窗（编辑模式不弹，免得干扰拖拽）。
 */
import type { MapPin } from '@/types';
import { cn } from '@/lib/utils';
import type { SpotTarget } from './mapOverlay';
import { PinGlyph } from './PinGlyph';
import type { MapViewMode } from './mapRender';

interface Props {
  pins: MapPin[];
  selectedPinId: string | null;
  /** 正在悬停（或触屏下点开）的标记：高亮它 */
  hoveredPinId: string | null;
  /** 编辑 / 预览：预览下点击只选中，不启动拖拽；也只有预览弹浮窗 */
  viewMode: MapViewMode;
  showLabels: boolean;
  onSelect: (pinId: string) => void;
  onDragStart: (pinId: string) => void;
  /** 预览模式：鼠标进入标记（浮窗定位要用锚点矩形） */
  onSpotHover?: (target: SpotTarget) => void;
  onSpotLeave?: () => void;
  /** 预览模式：点击标记（触屏弹底部抽屉） */
  onSpotTap?: (target: SpotTarget) => void;
}

export function MapPinLayer({
  pins, selectedPinId, hoveredPinId, viewMode, showLabels, onSelect, onDragStart,
  onSpotHover, onSpotLeave, onSpotTap,
}: Props) {
  const interactive = viewMode === 'preview';

  return (
    <>
      {pins.map((pin) => {
        const active = pin.id === selectedPinId;
        const hovered = pin.id === hoveredPinId;
        return (
          <button
            key={pin.id}
            data-wf-map-pin={pin.id}
            className={cn('absolute select-none rounded-full text-center', active ? 'z-20' : 'z-10', hovered && !active && 'z-20')}
            style={{
              left: `${pin.x * 100}%`,
              top: `${pin.y * 100}%`,
              /**
               * 位置由 left/top 百分比跟着底图走，尺寸乘上反向倍率保持**屏幕尺寸恒定**
               * —— 连点击区一起恒定。这一点很关键：只缩内层的话，6 倍时按钮的
               * 命中区也会变成 144px，几个相邻标记会互相遮挡。
               * 不能用 transition：缩放时反向倍率每帧都在变，加过渡会出现"图钉在水里飘"。
               */
              transform: 'translate(-50%, -50%) scale(var(--wf-map-inv-scale, 1))',
            }}
            title={`${pin.label}${pin.note ? `\n${pin.note}` : ''}`}
            onPointerDown={(e) => {
              // 阻止冒泡：否则会被画布当成「空白点击」而新建标记
              e.stopPropagation();
              onSelect(pin.id);
              // 触屏的抽屉在**按下**这一瞬就开：等到 click 的话，选中让检查器展开、
              // 画布变窄、图钉挪走，那次 click 的目标就不是这个图钉了。
              if (interactive) onSpotTap?.({ kind: 'pin', id: pin.id });
              // 预览模式只选中：不进入拖拽（拖拽的每次 pointermove 都会写坐标）
              if (viewMode === 'edit') onDragStart(pin.id);
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerEnter={
              interactive
                ? (e) => onSpotHover?.({ kind: 'pin', id: pin.id, anchor: e.currentTarget.getBoundingClientRect() })
                : undefined
            }
            onPointerLeave={interactive ? () => onSpotLeave?.() : undefined}
          >
            {/* 选中/悬停的放大只作用在内层，所以可以放心加过渡 */}
            <span className={cn('relative block transition-transform', active ? 'scale-125' : 'hover:scale-110')}>
              <span
                className="flex size-6 items-center justify-center rounded-full border-[1.5px] shadow-sm"
                style={{ borderColor: pin.color, background: 'hsl(var(--card))' }}
              >
                <PinGlyph icon={pin.icon} className="size-3.5 text-foreground" />
              </span>

              {/* 预览模式的悬停高亮：一圈实线色环 */}
              {hovered && interactive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1.5 rounded-full border-2"
                  style={{ borderColor: pin.color }}
                />
              )}

              {/* 选中的虚线控制圈：只在编辑模式出现（预览模式下它属于「编辑痕迹」） */}
              {active && viewMode === 'edit' && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1.5 rounded-full border border-dashed"
                  style={{ borderColor: pin.color }}
                />
              )}

              {showLabels && (
                <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-[10px] text-card-foreground shadow-sm">
                  {pin.label}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </>
  );
}
