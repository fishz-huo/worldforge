/**
 * 地图侧栏
 * ------------------------------------------------------------------
 * 管理「多张地图」（见 MapListPanel）、当前地图属性（见 MapSettingsForm）、
 * 绘制工具与图层显示选项。
 */
import { Crosshair, Layers, MousePointer2, Move, Pentagon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SectionTitle } from '@/components/ui/primitives';
import { SidePanel } from '@/components/layout/Panel';
import type { MapTool, RegionResources } from '@/types';
import { RESOURCE_METRICS } from '@/types';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { MapListPanel } from './MapListPanel';
import { MapSettingsForm } from './MapSettingsForm';
import type { MapViewMode } from './mapRender';

/**
 * 绘制工具
 * 图标换成 lucide 细线（原来是 🖱📍⬟✥ 这类 emoji）：地图画布上的标记
 * 已经改成线性图标，侧栏再用 emoji 会明显不是一套。
 */
const TOOLS: { tool: MapTool; label: string; Icon: LucideIcon; hint: string }[] = [
  { tool: 'select', label: '选择', Icon: MousePointer2, hint: '点选地图上的标记或区域进行编辑' },
  { tool: 'pin', label: '打点', Icon: Crosshair, hint: '在空白处点击即落一个标记点' },
  { tool: 'region', label: '区域', Icon: Pentagon, hint: '新建区域后拖动白色顶点调整轮廓' },
  { tool: 'pan', label: '平移', Icon: Move, hint: '预留：拖动整张画布' },
];

interface Props {
  /** 编辑 / 预览：预览下收起「绘制工具」（画布上的编辑入口） */
  viewMode: MapViewMode;
  tool: MapTool;
  setTool: (t: MapTool) => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  regionMode: 'fill' | 'outline' | 'resource';
  setRegionMode: (v: 'fill' | 'outline' | 'resource') => void;
  resourceKey: keyof RegionResources;
  setResourceKey: (k: keyof RegionResources) => void;
}

export function MapSidebar({
  viewMode, tool, setTool, showLabels, setShowLabels, regionMode, setRegionMode, resourceKey, setResourceKey,
}: Props) {
  const maps = useStore((s) => s.maps);
  const selectedMapId = useStore((s) => s.selectedMapId);
  const addRegion = useStore((s) => s.addRegion);
  const regions = useStore((s) => s.regions);
  const pins = useStore((s) => s.pins);

  const map = maps.find((m) => m.id === selectedMapId) ?? null;
  const mapRegions = regions.filter((r) => r.map_id === map?.id);

  // 侧栏底色只传 class：SidePanel 是所有模块共用的外壳，不改它。
  // 设计稿要的是「浅灰背景 + 选中项淡紫」，后者列表项与工具按钮自己已经带了。
  return (
    <SidePanel title="地图" className="bg-muted/40">
      <div className="space-y-3 p-2">
        <MapListPanel />

        {map && (
          <>
            <MapSettingsForm map={map} />

            {/* 绘制工具只在编辑模式出现：预览模式是纯查看，不该有画笔 */}
            {viewMode === 'edit' && (
              <>
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
              </>
            )}

            <SectionTitle
              right={
                // 预览模式不给「新建区域」：它是画布编辑入口，建出来的区域在预览下也拖不动
                viewMode === 'edit' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-[10px]"
                    onClick={() => addRegion(map.id)}
                  >
                    新建区域
                  </Button>
                ) : undefined
              }
            >
              区域（{mapRegions.length}）
            </SectionTitle>

            <SectionTitle>显示选项</SectionTitle>
            <div className="space-y-1.5 px-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px]">显示名称标签</span>
                <Switch checked={showLabels} onCheckedChange={setShowLabels} />
              </div>
              <div className="space-y-1">
                <Label>区域着色</Label>
                <div className="flex gap-1">
                  {(['fill', 'outline', 'resource'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setRegionMode(m)}
                      className={cn(
                        'flex-1 rounded border px-1 py-1 text-[10px]',
                        regionMode === m
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border bg-card hover:bg-accent',
                      )}
                    >
                      {m === 'fill' ? '填充' : m === 'outline' ? '轮廓' : '资源热度'}
                    </button>
                  ))}
                </div>
              </div>
              {regionMode === 'resource' && (
                <div className="space-y-1">
                  <Label>热度指标</Label>
                  <div className="flex flex-wrap gap-1">
                    {RESOURCE_METRICS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setResourceKey(m.key)}
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[10px]',
                          resourceKey === m.key
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border bg-card hover:bg-accent',
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
              <Layers className="size-3" />
              标记 {pins.filter((p) => p.map_id === map.id).length} · 区域 {mapRegions.length}
            </div>
          </>
        )}
      </div>
    </SidePanel>
  );
}
