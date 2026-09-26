/**
 * 地图侧栏
 * ------------------------------------------------------------------
 * 管理「多张地图」（见 MapListPanel）、当前地图属性（见 MapSettingsForm）、
 * 绘制工具、地形笔刷（见 TerrainPalette）与显示选项（见 MapDisplayOptions）。
 */
import { Crosshair, Layers, MousePointer2, Move, Pentagon, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { SidePanel } from '@/components/layout/Panel';
import type { MapTool, RegionResources } from '@/types';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { MapDisplayOptions } from './MapDisplayOptions';
import { MapExportPanel } from './MapExportPanel';
import { MapListPanel } from './MapListPanel';
import { MapSettingsForm } from './MapSettingsForm';
import { isTerrainPin } from './mapTerrain';
import type { TerrainSymbol } from './mapTerrain';
import type { MapViewMode } from './mapRender';
import type { Size } from './mapViewport';
import type { MapViewportApi } from './mapViewportApi';
import { TerrainPalette } from './TerrainPalette';

/**
 * 绘制工具
 * 图标换成 lucide 细线（原来是 🖱📍⬟✥ 这类 emoji）：地图画布上的标记
 * 已经改成线性图标，侧栏再用 emoji 会明显不是一套。
 */
const TOOLS: { tool: MapTool; label: string; Icon: LucideIcon; hint: string }[] = [
  { tool: 'select', label: '选择', Icon: MousePointer2, hint: '点选标记或区域，按住区域内部可整体拖动它；在空白处按住拖动＝框选，Shift+拖动＝追加框选（可以从区域内部起手）' },
  { tool: 'pin', label: '打点', Icon: Crosshair, hint: '在空白处点击即落一个标记点，可连续落；Esc 或再点一次本按钮退出' },
  { tool: 'region', label: '区域', Icon: Pentagon, hint: '在空白处按住拖动即新建一个矩形区域（松手生效）；拖动白色顶点改轮廓；Ctrl/⌘ 点边缘加顶点、Alt 点顶点删顶点' },
  { tool: 'pan', label: '平移', Icon: Move, hint: '拖动整张画布；任何模式下按住空格拖动、或按住鼠标中键拖动，都能平移' },
];

interface Props {
  /** 编辑 / 预览：预览下收起「绘制工具」与「地形」（画布上的编辑入口） */
  viewMode: MapViewMode;
  tool: MapTool;
  setTool: (t: MapTool) => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  regionMode: 'fill' | 'outline' | 'resource';
  setRegionMode: (v: 'fill' | 'outline' | 'resource') => void;
  resourceKey: keyof RegionResources;
  setResourceKey: (k: keyof RegionResources) => void;
  /** 地形笔刷（null = 没在画地形） */
  brush: TerrainSymbol | null;
  setBrush: (s: TerrainSymbol | null) => void;
  /**
   * 底图的世界尺寸与视口 API：左栏的「导出图片」要用。
   * 只加这两个（不给左栏透传导出面板那 11 个入参）：其余 9 个左栏自己就有 ——
   * map / pins / regions 是它自己读的 store，regionMode / resourceKey /
   * showLabels 本来就是它的 props（2026-09-25 入口从工具条搬来时定下）。
   */
  world: Size;
  viewport: MapViewportApi;
}

export function MapSidebar({
  viewMode, tool, setTool, showLabels, setShowLabels, regionMode, setRegionMode, resourceKey,
  setResourceKey, brush, setBrush, world, viewport,
}: Props) {
  const maps = useStore((s) => s.maps);
  const selectedMapId = useStore((s) => s.selectedMapId);
  const addRegion = useStore((s) => s.addRegion);
  const regions = useStore((s) => s.regions);
  const pins = useStore((s) => s.pins);

  const map = maps.find((m) => m.id === selectedMapId) ?? null;
  const mapRegions = regions.filter((r) => r.map_id === map?.id);
  /** 地形也是 map_pins 的行，统计时要按 meta.kind 分开数（导出的两张清单也要分开） */
  const mapPins = pins.filter((p) => p.map_id === map?.id);
  const terrainPins = mapPins.filter(isTerrainPin);
  const plainPins = mapPins.filter((p) => !isTerrainPin(p));
  const terrainCount = terrainPins.length;
  const pinCount = plainPins.length;

  return (
    <SidePanel title="地图">
      <div className="space-y-3 p-2">
        {/*
          预览模式只留「看地图」要用的两样东西：地图列表（可切换）+ 新建地图输入框。
          名称 / 时期标签 / 对应刻度 / 底图 / 不透明度 / 绘制工具 / 地形 / 显示选项 /
          统计行都是编辑用的，留在预览里只会干扰视线；切回编辑模式它们会原样回来。
        */}
        <MapListPanel />

        {map && viewMode === 'edit' && (
          <>
            {/*
              key={map.id} 是必须的：表单里的名称 / 时期标签 / 对应刻度是**非受控**
              输入框（defaultValue + onBlur），而换地图时 React 会复用同一个组件实例、
              忽略新的 defaultValue —— 结果是新建或切换地图后，框里仍显示上一张图的
              值；此时只要点一下输入框再离开，onBlur 就会把残留值写进**新地图**
              （静默改名）。换 key 让整块表单随地图重建，显示与落库都跟着当前地图走。
            */}
            <MapSettingsForm key={map.id} map={map} />

            <SectionTitle>绘制工具</SectionTitle>
            <div className="grid grid-cols-4 gap-1">
              {TOOLS.map(({ tool: value, label, Icon: ToolIcon, hint }) => (
                <button
                  key={value}
                  onClick={() => setTool(value)}
                  title={hint}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-[10px] transition-colors',
                    value === tool
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-card hover:bg-accent',
                  )}
                >
                  <ToolIcon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {TOOLS.find((t) => t.tool === tool)?.hint}
            </p>

            {/* 地形笔刷紧跟绘制工具之后（用户指定位置） */}
            <SectionTitle>地形</SectionTitle>
            <TerrainPalette brush={brush} onPick={setBrush} />

            <SectionTitle
              right={
                /*
                  第三轮问题四：原来是一个纯文字 ghost 按钮（h-6、无图标），
                  看着不像能点。改成「描边 + 加号 + 主色」——左栏的「区域着色」
                  「热度指标」本来就是这套描边 + 主色的语言；不做主色实心，
                  是因为左栏已经有一个实心的「新建地图」，两个实心会互相抢。
                */
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 border-primary/50 px-2 text-[10px] text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => addRegion(map.id)}
                >
                  <Plus className="size-3" /> 新建区域
                </Button>
              }
            >
              区域（{mapRegions.length}）
            </SectionTitle>

            <SectionTitle>显示选项</SectionTitle>
            <MapDisplayOptions
              showLabels={showLabels}
              setShowLabels={setShowLabels}
              regionMode={regionMode}
              setRegionMode={setRegionMode}
              resourceKey={resourceKey}
              setResourceKey={setResourceKey}
            />

            <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
              <Layers className="size-3" />
              标记 {pinCount} · 区域 {mapRegions.length} · 地形 {terrainCount}
            </div>
          </>
        )}

        {/*
          「导出图片」入口（2026-09-25 从工具条搬到左栏）：渲染在
          `viewMode === 'edit'` 分支**之外**，所以**编辑与预览都在** ——
          预览是最常导出的场景，而预览模式下左栏只剩地图列表，放进分支里就没了。
          编辑模式下它排在统计小字行之后（左栏真正的底部）。
        */}
        {map && (
          <>
            <SectionTitle>导出</SectionTitle>
            <MapExportPanel
              mapName={map.name}
              world={world}
              assetId={map.asset_id}
              opacity={map.opacity}
              viewport={viewport}
              pins={plainPins}
              regions={mapRegions}
              terrain={terrainPins}
              regionMode={regionMode}
              resourceKey={resourceKey}
              showLabels={showLabels}
            />
          </>
        )}
      </div>
    </SidePanel>
  );
}
