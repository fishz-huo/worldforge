/**
 * 地图概览（未选中标记或区域时显示）
 * ------------------------------------------------------------------
 * 回答两个问题：
 *  1. 这张图上，各区域的某项资源谁多谁少？（区域排行）
 *  2. 把不同时期的地图放在一起看，资源总量怎么变的？（跨地图对比）
 */
import { useMemo, useState } from 'react';
import { Crosshair, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { SectionTitle } from '@/components/ui/primitives';
import { RESOURCE_METRICS } from '@/types';
import { useStore } from '@/store';
import { RegionCompareChart, ResourceOverTime } from './ResourceChart';

/** 指标选择器 */
function MetricPicker({
  value,
  onChange,
}: {
  value: (typeof RESOURCE_METRICS)[number]['key'];
  onChange: (v: (typeof RESOURCE_METRICS)[number]['key']) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>对比指标</Label>
      <div className="flex flex-wrap gap-1">
        {RESOURCE_METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            className={`rounded border px-1.5 py-0.5 text-[10px] ${
              value === m.key ? 'border-primary text-primary' : 'border-border hover:bg-accent'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MapOverview({ mapId }: { mapId: string }) {
  // ⚠️ selector 里绝不能做 filter/map/slice：它们每次都返回新数组，
  // zustand 用 Object.is 比较快照，会永远判定「数据变了」并无限重渲染
  // （React 报 "Maximum update depth exceeded"，整个应用白屏）。
  // 正确做法：selector 只取原始引用，派生数据一律交给 useMemo。
  const allRegions = useStore((s) => s.regions);
  const maps = useStore((s) => s.maps);
  const regions = useMemo(
    () => allRegions.filter((r) => r.map_id === mapId),
    [allRegions, mapId],
  );
  const [metric, setMetric] = useState<(typeof RESOURCE_METRICS)[number]['key']>('population');

  /** 跨地图对比：每张地图（= 一个时期）该项资源的总量 */
  const series = useMemo(
    () =>
      maps
        .map((m, i) => {
          const value = allRegions
            .filter((r) => r.map_id === m.id)
            .reduce((sum, r) => sum + Number(r.resources?.[metric] ?? 0), 0);
          return { label: m.period || m.name, value, color: `hsl(${(i * 47) % 360} 70% 55%)` };
        })
        .filter((s) => s.value > 0),
    [maps, allRegions, metric],
  );

  return (
    <div className="space-y-3 p-2">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Info className="size-3" /> 点击地图上的标记或区域即可编辑
      </div>

      <MetricPicker value={metric} onChange={setMetric} />

      <SectionTitle>本图区域排行</SectionTitle>
      <RegionCompareChart regions={regions} metricKey={metric} />

      <SectionTitle>跨地图时期对比</SectionTitle>
      <ResourceOverTime series={series} metricKey={metric} />

      <div className="rounded-md border border-border bg-card/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
        <Crosshair className="mb-1 size-3" />
        为每个关键时期建一张地图并填写「时期标签」，就能在上面这张图里看到资源与疆域的演变。
      </div>
    </div>
  );
}
