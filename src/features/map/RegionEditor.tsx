/**
 * 地图区域编辑器（行政区 / 势力范围 / 资源区）
 * ------------------------------------------------------------------
 * 需求 2：行政区域与资源的变化划分。
 * 资源是数值化的，所以能汇总、能排行、能跨时期对比。
 */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SectionTitle } from '@/components/ui/primitives';
import { AutoInput, AutoNumber, AutoTextarea } from '@/components/common/AutoField';
import { RESOURCE_METRICS, type RegionResources } from '@/types';
import { useStore } from '@/store';
import { RegionResourceBars } from './ResourceChart';

export function RegionEditor({ regionId }: { regionId: string }) {
  const region = useStore((s) => s.regions.find((r) => r.id === regionId));
  const updateRegion = useStore((s) => s.updateRegion);
  const deleteRegion = useStore((s) => s.deleteRegion);
  const appendRegionPoint = useStore((s) => s.appendRegionPoint);
  const removeRegionPoint = useStore((s) => s.removeRegionPoint);
  if (!region) return null;
  const res = region.resources ?? {};

  /** 写入单个资源指标 */
  const setResource = (key: keyof RegionResources, value: number | null) => {
    updateRegion(region.id, { resources: { ...res, [key]: value === null ? undefined : value } as RegionResources });
  };

  return (
    <div className="space-y-2 p-2">
      <div className="space-y-1">
        <Label>区域名称</Label>
        <AutoInput value={region.name} onCommit={(name) => updateRegion(region.id, { name })} />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label>颜色</Label>
          <input
            type="color"
            value={region.color}
            onChange={(e) => updateRegion(region.id, { color: e.target.value })}
            className="h-8 w-full cursor-pointer rounded border border-border bg-transparent"
          />
        </div>
        <div className="space-y-1">
          <Label>所属时期</Label>
          <AutoInput
            value={region.period}
            onCommit={(period) => updateRegion(region.id, { period })}
            placeholder="如：245 年"
          />
        </div>
      </div>

      <SectionTitle>资源</SectionTitle>
      <div className="space-y-1.5">
        {RESOURCE_METRICS.map((m) => (
          <div key={m.key} className="grid grid-cols-[5rem_1fr] items-center gap-2">
            <Label title={m.unit}>{m.label}</Label>
            <AutoNumber value={Number(res[m.key] ?? 0)} onCommit={(v) => setResource(m.key, v ?? 0)} />
          </div>
        ))}
      </div>
      <RegionResourceBars region={region} />

      <SectionTitle>轮廓顶点（{region.points.length}）</SectionTitle>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 text-[10px]"
          onClick={() => appendRegionPoint(region.id, [0.5, 0.5])}
        >
          <Plus className="size-3" /> 加顶点
        </Button>
        {region.points.map((_, i) => (
          <button
            key={i}
            onClick={() => removeRegionPoint(region.id, i)}
            disabled={region.points.length <= 3}
            title="点击删除该顶点（至少保留 3 个）"
            className="rounded border border-border px-1 py-0.5 text-[10px] hover:border-destructive hover:text-destructive disabled:opacity-40"
          >
            顶点 {i + 1}
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        在地图上选中该区域后，拖动白色顶点即可调整轮廓。
      </p>

      <div className="space-y-1">
        <Label>备注</Label>
        <AutoTextarea value={region.note} onCommit={(note) => updateRegion(region.id, { note })} minHeight={50} />
      </div>

      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => deleteRegion(region.id)}>
        <Trash2 className="size-3.5" /> 删除区域
      </Button>
    </div>
  );
}
