/**
 * 地图缩放控件：缩小 / 百分比 / 放大 / 适应屏幕
 * ==================================================================
 * 百分比的含义：100% = 「适应屏幕」（整张底图刚好铺满），最大 600%。
 * 这样对用户来说「100% = 能看全」是最直观的基准，也避免了"4096 的底图
 * 在 600px 画布里 1:1 显示就是 683%"这种没法解释的数字。
 *
 * 尺寸与左栏「平移」工具、右栏模式开关一致：统一 h-8 里的控件、
 * gap-0.5 的胶囊外壳（对齐用户 2026-09-24 定的工具条口径）。
 */
import { Maximize2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ZOOM_STEP } from './mapViewport';

export function MapZoomControls({
  percent,
  onZoom,
  onFit,
}: {
  percent: number;
  /** 传倍率：>1 放大、<1 缩小；锚点默认取画布中心 */
  onZoom: (factor: number) => void;
  onFit: () => void;
}) {
  return (
    // 浮在底图上，所以底色要不透明一点 + 一道细阴影，否则压在深色地图上看不清
    <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-full border border-border bg-background/90 p-0.5 shadow-sm">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        title="缩小"
        aria-label="缩小地图"
        onClick={() => onZoom(1 / ZOOM_STEP)}
      >
        <Minus className="size-3.5" />
      </Button>
      <span
        className="min-w-[2.5rem] select-none text-center text-[11px] tabular-nums text-muted-foreground"
        title="100% = 适应屏幕"
      >
        {percent}%
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        title="放大"
        aria-label="放大地图"
        onClick={() => onZoom(ZOOM_STEP)}
      >
        <Plus className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px]"
        title="整张底图完整显示（回到 100%）"
        onClick={onFit}
      >
        <Maximize2 className="size-3.5" />
        适应屏幕
      </Button>
    </div>
  );
}
