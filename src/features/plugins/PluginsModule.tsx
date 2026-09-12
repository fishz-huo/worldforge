/**
 * 插件模块
 * ------------------------------------------------------------------
 * 需求 14：美化或增加功能的插件区，能够载入插件（插件插口）。
 * 这里提供：安装、启用停用、设置、源码查看，以及「已注册插口一览」，
 * 让用户清楚插件到底挂上了什么。
 */
import { useState } from 'react';
import { Download, Puzzle, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { EmptyState, SectionTitle } from '@/components/ui/primitives';
import { SidePanel, ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { BUILTIN_PLUGINS } from '@/lib/plugin/builtins';
import { HOST_VERSION } from '@/lib/plugin/host';
import { cn } from '@/lib/utils';
import { usePluginRegistry } from '@/hooks/usePluginRegistry';
import { useStore } from '@/store';
import { InstallPluginDialog } from './InstallPluginDialog';
import { PluginDetail } from './PluginDetail';
import { PluginPanelHost } from './PluginPanelHost';

/** 插口注册情况一览 */
function RegistrySummary() {
  const registry = usePluginRegistry();
  const items: [string, number][] = [
    ['卡片类型', registry.cardTypes.length],
    ['追加字段', registry.extraFields.length],
    ['面板', registry.panels.length],
    ['命令', registry.commands.length],
    ['卡片动作', registry.cardActions.length],
    ['主题', registry.themes.length],
    ['导出器', registry.exporters.length],
  ];
  return (
    <div className="flex flex-wrap gap-1 px-1">
      {items.map(([label, count]) => (
        <Badge key={label} variant={count > 0 ? 'default' : 'outline'}>
          {label} {count}
        </Badge>
      ))}
    </div>
  );
}

export function PluginsModule() {
  const plugins = useStore((s) => s.plugins);
  const setPluginEnabled = useStore((s) => s.setPluginEnabled);
  const installPlugin = useStore((s) => s.installPlugin);
  const [installOpen, setInstallOpen] = useState(false);

  const missingBuiltins = BUILTIN_PLUGINS.filter((b) => !plugins.some((p) => p.id === b.id));

  return (
    <ModuleLayout>
      <SidePanel
        title="插件"
        actions={
          <Button variant="ghost" size="icon-sm" title="载入插件" onClick={() => setInstallOpen(true)}>
            <Upload />
          </Button>
        }
      >
        <div className="space-y-2 p-2">
          <Button className="w-full gap-1.5" size="sm" onClick={() => setInstallOpen(true)}>
            <Upload className="size-3.5" /> 载入插件
          </Button>

          <SectionTitle>已安装 {plugins.length}</SectionTitle>
          <div className="space-y-0.5">
            {plugins.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'rounded border px-2 py-1.5 transition-colors',
                  p.enabled ? 'border-primary/40 bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Puzzle className={cn('size-3.5 shrink-0', p.enabled ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
                  <Switch checked={p.enabled === 1} onCheckedChange={(v) => void setPluginEnabled(p.id, v)} />
                </div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{p.description || p.author}</div>
              </div>
            ))}
            {plugins.length === 0 && <div className="px-1 py-2 text-[11px] text-muted-foreground">还没有插件。</div>}
          </div>

          {missingBuiltins.length > 0 && (
            <>
              <SectionTitle>恢复内置示例</SectionTitle>
              <div className="space-y-1">
                {missingBuiltins.map((b) => (
                  <Button
                    key={b.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-1.5 text-[11px]"
                    onClick={() =>
                      void installPlugin(b.code, { id: b.id, name: b.name, description: b.description, builtin: 1 })
                    }
                  >
                    <Download className="size-3" /> {b.name}
                  </Button>
                ))}
              </div>
            </>
          )}

          <div className="px-1 text-[10px] text-muted-foreground">宿主版本 v{HOST_VERSION}</div>
        </div>
      </SidePanel>

      <ModuleBody>
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 space-y-1 border-b border-border p-2">
            <SectionTitle>插件插口注册情况</SectionTitle>
            <RegistrySummary />
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2">
            <div className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
              <div className="px-2 pt-2">
                <SectionTitle>插件面板</SectionTitle>
              </div>
              <PluginPanelHost className="min-h-[240px]" />
            </div>

            <div className="space-y-2 p-2">
              <SectionTitle>插件详情与设置</SectionTitle>
              {plugins.length === 0 && (
                <EmptyState
                  icon={<Puzzle />}
                  title="没有插件"
                  description="可以从内置示例开始，或载入自己的 JS 插件。"
                />
              )}
              {plugins.map((p) => (
                <PluginDetail key={p.id} plugin={p} />
              ))}
            </div>
          </div>
        </div>
      </ModuleBody>

      <InstallPluginDialog open={installOpen} onOpenChange={setInstallOpen} />
    </ModuleLayout>
  );
}
