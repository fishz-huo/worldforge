/**
 * 地图工具条
 * ==================================================================
 * 从 MapModule 抽出来（那个文件接上视口与浮窗后顶到 200 行上限）。
 *
 * 高度规则不要改动：整条 min-h-9（36px，含自己的 border-b）与左右面板标题行
 * 的 h-9 底边齐平（用户 2026-09-24 选的方案 B：宁可改自己模块的高度，
 * 也不去动全应用共用的外壳）；同一条工具条里的控件统一 h-8 + items-center +
 * gap-2，三个按钮基底都是透明文字按钮，只有"当前工具"带淡紫底。
 * 窄窗口下这一行 flex-wrap 换行（固定高会把第二行裁掉）。
 */
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
  mode,
  onModeChange,
  tool,
  onToolChange,
  onAddRegion,
}: {
  map: MapDef;
  pinCount: number;
  regionCount: number;
  mode: MapViewMode;
  onModeChange: (next: MapViewMode) => void;
  tool: MapTool;
  onToolChange: (tool: MapTool) => void;
  onAddRegion: () => void;
}) {
  return (
    <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 text-xs">
      <span className="font-medium">{map.name}</span>
      {map.period && <span className="text-muted-foreground">· {map.period}</span>}
      <span className="text-muted-foreground">
        · 标记 {pinCount} · 区域 {regionCount}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {mode === 'edit' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 gap-1', tool === 'pin' && TOOL_ACTIVE)}
              onClick={() => onToolChange('pin')}
            >
              <Crosshair className="size-3.5" /> 打点模式
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 gap-1', tool === 'select' && TOOL_ACTIVE)}
              onClick={() => onToolChange('select')}
            >
              <MousePointer2 className="size-3.5" /> 选择
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={onAddRegion}>
              <Plus className="size-3.5" /> 新建区域
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => onToolChange('select')}>
            <MousePointer2 className="size-3.5" /> 选择
          </Button>
        )}

        <span aria-hidden className="h-5 w-px bg-border" />
        <MapModeSwitch mode={mode} onChange={onModeChange} />
      </div>
    </div>
  );
}
