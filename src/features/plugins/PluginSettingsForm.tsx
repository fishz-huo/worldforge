/**
 * 插件设置表单
 * ------------------------------------------------------------------
 * 插件在 manifest.settings 里声明设置项，宿主据此自动渲染表单，
 * 插件作者不需要写任何 UI 代码。
 */
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { PluginSettingDef } from '@/types';
import { useStore } from '@/store';

export function PluginSettingsForm({
  pluginId,
  schema,
  values,
}: {
  pluginId: string;
  schema: Record<string, PluginSettingDef>;
  values: Record<string, unknown>;
}) {
  const updatePluginSettings = useStore((s) => s.updatePluginSettings);
  const entries = Object.entries(schema);

  if (entries.length === 0) {
    return <div className="text-[11px] text-muted-foreground">该插件没有声明设置项。</div>;
  }

  const setValue = (key: string, value: unknown) => {
    updatePluginSettings(pluginId, { ...values, [key]: value });
  };

  return (
    <div className="space-y-2">
      {entries.map(([key, def]) => {
        const value = values[key] ?? def.default;
        return (
          <div key={key} className="grid grid-cols-[7rem_1fr] items-center gap-2">
            <Label title={def.hint}>{def.label}</Label>
            <div>
              {def.type === 'boolean' ? (
                <Switch checked={Boolean(value)} onCheckedChange={(v) => setValue(key, v)} />
              ) : def.type === 'number' ? (
                <Input
                  type="number"
                  defaultValue={String(value ?? 0)}
                  onBlur={(e) => setValue(key, Number(e.target.value))}
                  className="h-7 text-xs"
                />
              ) : def.type === 'color' ? (
                <input
                  type="color"
                  value={String(value ?? '#888888')}
                  onChange={(e) => setValue(key, e.target.value)}
                  className="h-7 w-16 cursor-pointer rounded border border-border bg-transparent"
                />
              ) : def.type === 'select' ? (
                <Select value={String(value ?? '')} onValueChange={(v) => setValue(key, v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {(def.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  defaultValue={String(value ?? '')}
                  onBlur={(e) => setValue(key, e.target.value)}
                  className="h-7 text-xs"
                />
              )}
              {def.hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{def.hint}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
