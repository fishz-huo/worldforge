/**
 * 地图资源图表
 * ------------------------------------------------------------------
 * 需求 2：资源（人口、农业、矿产…）要能可视化对比。
 * 用纯 SVG/div 画条形图，不引入图表库（保持体积）。
 */
import { RESOURCE_METRICS, type MapRegion } from '@/types';
import { cn } from '@/lib/utils';

/** 区域内各资源的横向条 */
export function RegionResourceBars({ region, className }: { region: MapRegion; className?: string }) {
  const max = 500; // 人口量级与指数混排时，用统一上限做视觉归一
  return (
    <div className={cn('space-y-1', className)}>
      {RESOURCE_METRICS.map((m) => {
        const value = Number(region.resources?.[m.key] ?? 0);
        if (!value) return null;
        return (
          <div key={m.key} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{m.label}</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: m.color }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[10px]">{value}</span>
          </div>
        );
      })}
      {Object.entries(region.resources?.custom ?? {}).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-8 shrink-0 truncate text-[10px] text-muted-foreground">{key}</span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, Number(value))}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right font-mono text-[10px]">{Number(value)}</span>
        </div>
      ))}
    </div>
  );
}

/** 多区域资源对比（同一指标下的排行） */
export function RegionCompareChart({
  regions,
  metricKey,
  className,
}: {
  regions: MapRegion[];
  metricKey: (typeof RESOURCE_METRICS)[number]['key'];
  className?: string;
}) {
  const metric = RESOURCE_METRICS.find((m) => m.key === metricKey) ?? RESOURCE_METRICS[0];
  const rows = regions
    .map((r) => ({ region: r, value: Number(r.resources?.[metricKey] ?? 0) }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className={cn('space-y-1', className)}>
      {rows.map(({ region, value }) => (
        <div key={region.id} className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="truncate">{region.name}</span>
            <span className="font-mono text-muted-foreground">
              {value} {metric.unit}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-sm transition-[width]"
              style={{ width: `${(value / max) * 100}%`, background: region.color }}
            />
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className="text-[11px] text-muted-foreground">还没有区域数据</div>}
    </div>
  );
}

/** 多地图同一区域的资源对比（表现「资源随时间的变化」） */
export function ResourceOverTime({
  series,
  metricKey,
}: {
  series: { label: string; value: number; color: string }[];
  metricKey: (typeof RESOURCE_METRICS)[number]['key'];
}) {
  const metric = RESOURCE_METRICS.find((m) => m.key === metricKey) ?? RESOURCE_METRICS[0];
  const max = Math.max(1, ...series.map((s) => s.value));
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-muted-foreground">
        指标：{metric.label}（{metric.unit}）· 按地图时期排列
      </div>
      <div className="flex h-24 items-end gap-1.5">
        {series.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="font-mono text-[10px]">{s.value}</span>
            <div
              className="w-full rounded-t"
              style={{ height: `${Math.max(2, (s.value / max) * 64)}px`, background: s.color }}
            />
            <span className="w-full truncate text-center text-[9px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
      {series.length === 0 && <div className="text-[11px] text-muted-foreground">还没有可对比的数据</div>}
    </div>
  );
}
