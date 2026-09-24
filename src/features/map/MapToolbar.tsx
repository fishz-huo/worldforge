/**
 * 地图工具条
 * ==================================================================
 * 从 MapModule 抽出来（那个文件接上视口与浮窗后顶到 200 行上限）。
 *
 * 高度规则不要改动：整条 min-h-9（36px，含自己的 border-b）与左右面板标题行
 * 的 h-9 底边齐平（用户 2026-09-24 选的方案 B：宁可改自己模块的高度，
 * 也不去动全应用共用的外壳）；同一条工具条里的控件统一 h-8 + items-center +
 * gap-2，按钮基底都是透明文字按钮，只有"当前工具"带淡紫底。
 * 窄窗口下这一行 flex-wrap 换行（固定高会把第二行裁掉）。
 *
 * 第三轮（问题五）：顺序统一成「选择 → 打点」，与左栏绘制工具同序（选择排第一）；
 * 「新建区域」是**动作**不是工具，用一条竖分隔线与两个工具分开。
 * 这里不再放「平移」入口 —— 左栏本来就有，而且按住空格 / 中键拖动随时能平移；
 * 工具条在 1280 窗口两栏全开时只有约 608px，加第四个按钮会把右侧模式开关挤到第二行。
 */
import type { ReactNode } from 'react';
import { Crosshair, MousePointer2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MapDef, MapTool } from '@/types';
import { MapModeSwitch } from './MapModeSwitch';
import type { MapViewMode } from './mapRender';

/** 当前工具的选中样式（淡紫底 + 压住 hover，免得悬停变色） */
const TOOL_ACTIVE = 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary';

export function MapToolbar({
  map,
  pinCount,
  regionCount,
  terrainCount,
  mode,
  onModeChange,
  tool,
  onToolChange,
  onAddRegion,
  extra,
}: {
  map: MapDef;
  pinCount: number;
  regionCount: number;
  /** 地形符号数（也是 map_pins 的行，按 meta.kind 分开数） */
  terrainCount: number;
  mode: MapViewMode;
  onModeChange: (next: MapViewMode) => void;
  tool: MapTool;
  onToolChange: (tool: MapTool) => void;
  onAddRegion: () => void;
  /**
   * 右侧的额外入口（本轮是「导出图片」）：由 MapStage 注入。
   * 工具条本身不认识导出，这样它的行数不会因为别处加功能而涨。
   */
  extra?: ReactNode;
}) {
  return (
    <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 text-xs">
      <span className="font-medium">{map.name}</span>
      {map.period && <span className="text-muted-foreground">· {map.period}</span>}
      <span className="text-muted-foreground">
        · 标记 {pinCount} · 区域 {regionCount} · 地形 {terrainCount}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {mode === 'edit' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 gap-1', tool === 'select' && TOOL_ACTIVE)}
              onClick={() => onToolChange('select')}
            >
              <MousePointer2 className="size-3.5" /> 选择
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 gap-1', tool === 'pin' && TOOL_ACTIVE)}
              onClick={() => onToolChange('pin')}
            >
              <Crosshair className="size-3.5" /> 打点模式
            </Button>
            <span aria-hidden className="h-5 w-px bg-border" />
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={onAddRegion}>
              <Plus className="size-3.5" /> 新建区域
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => onToolChange('select')}>
            <MousePointer2 className="size-3.5" /> 选择
          </Button>
        )}

        {extra}

        <span aria-hidden className="h-5 w-px bg-border" />
        <MapModeSwitch mode={mode} onChange={onModeChange} />
      </div>
    </div>
  );
}
