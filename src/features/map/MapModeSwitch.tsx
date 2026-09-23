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
      className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5"
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
              // h-full = 撑满胶囊内容区（外高 h-8 减掉 1px 边框与 2px 内边距），
              // 这样胶囊的**外高**才与旁边 h-8 的按钮完全一致
              'flex h-full items-center gap-1 rounded-full px-2.5 text-xs transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {/* Button 组件里有 [&_svg]:size-4（16px），这里跟着用同尺寸，两边图标才一样大 */}
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
