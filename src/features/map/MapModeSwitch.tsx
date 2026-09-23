/**
 * 地图「编辑 / 预览」模式切换（胶囊开关）
 * ------------------------------------------------------------------
 * 编辑 = 保留全部编辑痕迹（网格、顶点手柄、绘制工具、虚线控制圈）；
 * 预览 = 纯查看，编辑痕迹与写入能力一起收起。
 *
 * 视觉对齐设计稿：胶囊外壳 + 选中段用主题的 primary（紫）实底高亮。
 * 两段都是真按钮（可 Tab 聚焦、回车触发），不做成纯装饰 div。
 */
import { Eye, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapViewMode } from './mapRender';

/** 模式顺序即显示顺序：编辑在左、预览在右 */
const ITEMS: { mode: MapViewMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'edit', label: '编辑', Icon: Pencil },
  { mode: 'preview', label: '预览', Icon: Eye },
];

export function MapModeSwitch({
  mode,
  onChange,
}: {
  mode: MapViewMode;
  onChange: (next: MapViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="地图视图模式"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5"
    >
      {ITEMS.map(({ mode: value, label, Icon }) => {
        const active = value === mode;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            title={value === 'edit' ? '编辑模式：可打点、可拖动、可改属性' : '预览模式：只查看，不会修改任何数据'}
            onClick={() => onChange(value)}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
