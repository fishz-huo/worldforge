/**
 * 地图侧栏
 * ------------------------------------------------------------------
 * 管理「多张地图」（见 MapListPanel）、当前地图属性（见 MapSettingsForm）、
 * 绘制工具与图层显示选项。
 */
import { Layers } from 'lucide-react';
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

/** 绘制工具 */
const TOOLS: { tool: MapTool; label: string; icon: string; hint: string }[] = [
  { tool: 'select', label: '选择', icon: '🖱', hint: '点选地图上的标记或区域进行编辑' },
  { tool: 'pin', label: '打点', icon: '📍', hint: '在空白处点击即落一个标记点' },
  { tool: 'region', label: '区域', icon: '⬟', hint: '新建区域后拖动白色顶点调整轮廓' },
  { tool: 'pan', label: '平移', icon: '✥', hint: '预留：拖动整张画布' },
];

interface Props {
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
  tool, setTool, showLabels, setShowLabels, regionMode, setRegionMode, resourceKey, setResourceKey,
}: Props) {
  const maps = useStore((s) => s.maps);
  const selectedMapId = useStore((s) => s.selectedMapId);
  const addRegion = useStore((s) => s.addRegion);
  const regions = useStore((s) => s.regions);
  const pins = useStore((s) => s.pins);

  const map = maps.find((m) => m.id === selectedMapId) ?? null;
  const mapRegions = regions.filter((r) => r.map_id === map?.id);

  return (
    <SidePanel title="地图">
      <div className="space-y-3 p-2">
        <MapListPanel />

        {map && (
          <>
            <MapSettingsForm map={map} />

            <SectionTitle>绘制工具</SectionTitle>
            <div className="grid grid-cols-4 gap-1">
              {TOOLS.map((t) => (
                <button
                  key={t.tool}
                  onClick={() => setTool(t.tool)}
                  title={t.hint}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-[10px] transition-colors',
                    tool === t.tool ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-accent',
                  )}
                >
                  <span className="text-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {TOOLS.find((t) => t.tool === tool)?.hint}
            </p>

            <SectionTitle
              right={
                <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px]" onClick={() => addRegion(map.id)}>
                  新建区域
                </Button>
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
                        regionMode === m ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-accent',
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
                          resourceKey === m.key ? 'border-primary text-primary' : 'border-border hover:bg-accent',
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
