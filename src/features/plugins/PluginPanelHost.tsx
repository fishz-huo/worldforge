/**
 * 插件面板宿主
 * ------------------------------------------------------------------
 * 渲染插件通过 api.registerPanel 注册的面板。
 * 插件使用 api.ui.React.createElement 构建界面，
 * 样式沿用宿主的 Tailwind 类名（因为插件运行在同一页面上下文里）。
 */
import { Component, useState, type ReactNode } from 'react';
import { Puzzle } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/ui/primitives';
import { usePluginRegistry } from '@/hooks/usePluginRegistry';
import { cn } from '@/lib/utils';

/** 错误边界：插件面板崩了不能拖垮整个应用 */
class PanelBoundary extends Component<{ children: ReactNode; name: string }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
          插件面板「{this.props.name}」渲染失败：{this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

export function PluginPanelHost({ className }: { className?: string }) {
  const registry = usePluginRegistry();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = registry.panels.find((p) => p.id === (activeId ?? registry.panels[0]?.id));

  if (registry.panels.length === 0) {
    return (
      <EmptyState
        icon={<Puzzle />}
        title="还没有插件面板"
        description="启用带面板的插件（例如内置的「写作统计」）后，这里会出现它们注册的界面。"
      />
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
        {registry.panels.map((panel) => (
          <button
            key={panel.id}
            onClick={() => setActiveId(panel.id)}
            className={cn(
              'flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors',
              active?.id === panel.id ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-accent',
            )}
          >
            <Icon name={panel.icon ?? 'Puzzle'} className="size-3" />
            {panel.title}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {active && (
          <PanelBoundary name={active.title}>
            {/* 插件面板由插件自己渲染 */}
            {active.render()}
          </PanelBoundary>
        )}
      </div>
    </div>
  );
}
