/**
 * 外观设置
 * ------------------------------------------------------------------
 * 需求 6：界面简约易看；需求 14：插件可提供配色（registerTheme）。
 */
import { Moon, Palette, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SectionTitle } from '@/components/ui/primitives';
import { usePluginRegistry } from '@/hooks/usePluginRegistry';
import { UI_SCALE_OPTIONS } from '@/store/prefs';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

export function AppearanceSettings() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const railOpen = useStore((s) => s.railOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const inspectorOpen = useStore((s) => s.inspectorOpen);
  const setRailOpen = useStore((s) => s.setRailOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setInspectorOpen = useStore((s) => s.setInspectorOpen);
  const columns = useStore((s) => s.cardColumns);
  const setColumns = useStore((s) => s.setCardColumns);
  const editorSplit = useStore((s) => s.editorSplit);
  const setEditorSplit = useStore((s) => s.setEditorSplit);
  const fontSize = useStore((s) => s.editorFontSize);
  const setFontSize = useStore((s) => s.setEditorFontSize);
  const uiScale = useStore((s) => s.uiScale);
  const setUiScale = useStore((s) => s.setUiScale);
  const resetPanelWidths = useStore((s) => s.resetPanelWidths);
  const registry = usePluginRegistry();

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <SectionTitle>明暗模式</SectionTitle>
        <div className="flex gap-2 px-1">
          {([
            { value: 'dark', label: '暗色', icon: Moon },
            { value: 'light', label: '亮色', icon: Sun },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs transition-colors',
                theme === opt.value ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-accent',
              )}
            >
              <opt.icon className="size-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>界面大小</SectionTitle>
        <div className="px-1">
          <div className="grid grid-cols-4 gap-1">
            {UI_SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setUiScale(opt.value)}
                className={cn(
                  'rounded-md border py-1.5 text-xs transition-colors',
                  uiScale === opt.value
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border hover:bg-accent',
                )}
              >
                {opt.label}
                <span className="ml-1 text-[10px] text-muted-foreground">{Math.round(opt.value * 100)}%</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            整界面等比缩放（工具栏、面板、字号一起变）。只影响显示，不影响导出的字号。
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>配色方案</SectionTitle>
        <div className="px-1">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            配色由「插件配色」提供（内置的深海配色含深海 · 暗 / 羊皮纸 · 亮两套）。
            插件停用或卸载后使用默认配色，亮暗两套同样完整。
          </p>
        </div>
      </section>

      {registry.themes.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>
            <span className="flex items-center gap-1">
              <Palette className="size-3" /> 插件配色（{registry.themes.length}）
            </span>
          </SectionTitle>
          <div className="space-y-1 px-1">
            {registry.themes.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded border border-border p-1.5">
                <div className="flex gap-0.5">
                  {['--background', '--primary', '--accent'].map((k) => (
                    <span
                      key={k}
                      className="size-4 rounded-sm border border-border"
                      style={{ background: `hsl(${t.vars[k] ?? '0 0% 50%'})` }}
                    />
                  ))}
                </div>
                <span className="min-w-0 flex-1 truncate text-xs">{t.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t.mode === 'dark' ? '暗色' : '亮色'} · {t.pluginName}
                </span>
              </div>
            ))}
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              插件主题会在对应的明暗模式下自动生效（同模式下最后注册的优先）。
              <br />
              停用或卸载插件后立刻回到默认配色，亮暗两套完整生效，不需要重启。
            </p>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle>布局</SectionTitle>
        <div className="space-y-2 px-1">
          {([
            ['导航栏', railOpen, setRailOpen],
            ['次级侧栏', sidebarOpen, setSidebarOpen],
            ['右侧检查器', inspectorOpen, setInspectorOpen],
            ['编辑器默认分栏', editorSplit, setEditorSplit],
          ] as const).map(([label, value, setter]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs">{label}</span>
              <Switch checked={value} onCheckedChange={setter} />
            </div>
          ))}
          <div className="space-y-1 pt-1">
            <Label>卡片库每行数量：{columns}</Label>
            <Slider
              value={[columns]}
              min={2}
              max={4}
              step={1}
              onValueChange={([v]) => setColumns(v as 2 | 3 | 4)}
            />
          </div>
          <div className="space-y-1">
            <Label>编辑器字号：{fontSize}px</Label>
            <Slider value={[fontSize]} min={12} max={22} step={1} onValueChange={([v]) => setFontSize(v)} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] leading-relaxed text-muted-foreground">
              左右两栏宽度：拖动两栏之间的分隔条调整，双击复位。
            </span>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => resetPanelWidths()}>
              重置宽度
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
