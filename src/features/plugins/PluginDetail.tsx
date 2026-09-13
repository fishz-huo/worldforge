/**
 * 插件详情卡片
 * ------------------------------------------------------------------
 * 启用开关、元信息、宿主自动渲染的设置表单、源码折叠查看。
 */
import { Power, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { PluginRecord } from '@/types';
import { cn, formatTime } from '@/lib/utils';
import { useStore } from '@/store';
import { PluginSettingsForm } from './PluginSettingsForm';
import { askConfirm } from '@/lib/confirm';

export function PluginDetail({ plugin }: { plugin: PluginRecord }) {
  const setPluginEnabled = useStore((s) => s.setPluginEnabled);
  const removePlugin = useStore((s) => s.removePlugin);
  const enabled = plugin.enabled === 1;

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="flex items-center gap-1.5">
        <Power className={cn('size-3.5', enabled ? 'text-emerald-400' : 'text-muted-foreground')} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{plugin.name}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">v{plugin.version}</span>
        <Switch checked={enabled} onCheckedChange={(v) => void setPluginEnabled(plugin.id, v)} />
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          title="卸载插件"
          onClick={async () => {
            if (await askConfirm(`卸载插件「${plugin.name}」？`)) removePlugin(plugin.id);
          }}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {plugin.author} · 安装于 {formatTime(plugin.created_at)}
        {plugin.builtin === 1 && ' · 内置示例'}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{plugin.description}</p>

      {enabled && Object.keys(plugin.settings_schema).length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Settings2 className="size-3" /> 插件设置
          </div>
          <PluginSettingsForm pluginId={plugin.id} schema={plugin.settings_schema} values={plugin.settings} />
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
          查看插件源码
        </summary>
        <pre className="mt-1 max-h-56 overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-[10px] leading-4">
          {plugin.code}
        </pre>
      </details>
    </div>
  );
}
