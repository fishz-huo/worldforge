/**
 * 外观设置
 * ------------------------------------------------------------------
 * 需求 6：界面简约易看；需求 14：插件可提供配色（registerTheme）。
 */
import { Check, Moon, Palette, Sun } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SectionTitle } from '@/components/ui/primitives';
import { usePluginRegistry } from '@/hooks/usePluginRegistry';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

/** 内置强调色 */
const ACCENTS: { name: string; value: string }[] = [
  { name: '紫', value: '262 83% 58%' },
  { name: '青', value: '187 85% 45%' },
  { name: '翠', value: '160 84% 39%' },
  { name: '琥珀', value: '38 92% 50%' },
  { name: '绯', value: '347 77% 50%' },
  { name: '靛', value: '221 83% 53%' },
];

export function AppearanceSettings() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const accent = useStore((s) => s.accent);
  const setAccent = useStore((s) => s.setAccent);
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
        <SectionTitle>强调色</SectionTitle>
        <div className="flex flex-wrap gap-2 px-1">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAccent(a.value)}
              title={a.name}
              className={cn(
                'flex size-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110',
                accent === a.value ? 'border-foreground' : 'border-transparent',
              )}
              style={{ background: `hsl(${a.value})` }}
            >
              {accent === a.value && <Check className="size-3.5 text-white" />}
            </button>
          ))}
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
        </div>
      </section>
    </div>
  );
}
