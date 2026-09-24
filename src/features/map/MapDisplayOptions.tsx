/**
 * 地图显示选项（显示名称标签 / 区域着色 / 热度指标）
 * ==================================================================
 * 从 MapSidebar 抽出来：那个文件要装地图列表、属性表单、绘制工具、区域计数与
 * 第三批的地形笔刷，再加上这三块会顶到「单文件 ≤200 行」。
 * 这里只有左栏的三组开关，没有任何数据写入逻辑（都是模块里的组件内状态）。
 */
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { RegionResources } from '@/types';
import { RESOURCE_METRICS } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  regionMode: 'fill' | 'outline' | 'resource';
  setRegionMode: (v: 'fill' | 'outline' | 'resource') => void;
  resourceKey: keyof RegionResources;
  setResourceKey: (k: keyof RegionResources) => void;
}

/** 三个小按钮的选中样式（左栏统一的语言：描边 + 主色底） */
const PICK = (active: boolean) =>
  cn(
    'rounded border px-1 py-1 text-[10px]',
    active ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card hover:bg-accent',
  );

export function MapDisplayOptions({
  showLabels, setShowLabels, regionMode, setRegionMode, resourceKey, setResourceKey,
}: Props) {
  return (
    <div className="space-y-1.5 px-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px]">显示名称标签</span>
        <Switch checked={showLabels} onCheckedChange={setShowLabels} />
      </div>

      <div className="space-y-1">
        <Label>区域着色</Label>
        <div className="flex gap-1">
          {(['fill', 'outline', 'resource'] as const).map((m) => (
            <button key={m} onClick={() => setRegionMode(m)} className={cn(PICK(regionMode === m), 'flex-1')}>
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
                className={cn(PICK(resourceKey === m.key), 'px-1.5 py-0.5')}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
