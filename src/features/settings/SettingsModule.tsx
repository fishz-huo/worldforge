/**
 * 设置模块
 * ------------------------------------------------------------------
 * 四块：外观 / 世界观 / 数据 / 关于。
 * 需求 6：所有界面开关集中在这里，且顶栏也有一键入口。
 */
import { Info, Keyboard, Palette, Database, Globe2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionTitle } from '@/components/ui/primitives';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { HOST_VERSION } from '@/lib/plugin/host';
import { MODULES } from '@/components/layout/modules';
import { useStore } from '@/store';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { WorldSettings } from './WorldSettings';

/** 快捷键说明表 */
const HOTKEYS: [string, string][] = [
  ['Ctrl / Cmd + K', '打开命令面板'],
  ['Ctrl / Cmd + S', '立即保存到本地'],
  ['Ctrl / Cmd + B', '显示 / 隐藏次级侧栏'],
  ['Ctrl / Cmd + I', '显示 / 隐藏右侧检查器'],
  ['Ctrl / Cmd + \\', '专注模式（三栏全收起）'],
  ['1 – 9', '直接切换到对应模块'],
  ['Esc', '关闭浮层、清空搜索'],
  ['[[', '在编辑器里唤起卡片引用选择器'],
];

export function SettingsModule() {
  const worlds = useStore((s) => s.worlds);
  const cards = useStore((s) => s.cards);
  const maps = useStore((s) => s.maps);
  const entries = useStore((s) => s.entries);
  const docs = useStore((s) => s.docs);
  const assets = useStore((s) => s.assets);
  const versions = useStore((s) => s.versions);
  const plugins = useStore((s) => s.plugins);

  return (
    <ModuleLayout>
      <ModuleBody className="overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl p-4">
          <Tabs defaultValue="appearance">
            <TabsList>
              <TabsTrigger value="appearance" className="gap-1">
                <Palette className="size-3" /> 外观
              </TabsTrigger>
              <TabsTrigger value="world" className="gap-1">
                <Globe2 className="size-3" /> 世界观
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-1">
                <Database className="size-3" /> 数据
              </TabsTrigger>
              <TabsTrigger value="about" className="gap-1">
                <Info className="size-3" /> 关于
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appearance" className="mt-3">
              <AppearanceSettings />
            </TabsContent>

            <TabsContent value="world" className="mt-3">
              <WorldSettings />
            </TabsContent>

            <TabsContent value="data" className="mt-3">
              <DataSettings />
            </TabsContent>

            <TabsContent value="about" className="mt-3 space-y-4">
              <section className="space-y-2">
                <SectionTitle>本机数据概览</SectionTitle>
                <div className="grid grid-cols-2 gap-2 px-1 sm:grid-cols-4">
                  {[
                    ['世界观', worlds.length],
                    ['卡片', cards.length],
                    ['地图', maps.length],
                    ['时间轴条目', entries.length],
                    ['文稿', docs.length],
                    ['图片', assets.length],
                    ['版本快照', versions.length],
                    ['插件', plugins.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-md border border-border p-2 text-center">
                      <div className="text-lg font-semibold">{value}</div>
                      <div className="text-[10px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <SectionTitle>
                  <span className="flex items-center gap-1">
                    <Keyboard className="size-3" /> 快捷键
                  </span>
                </SectionTitle>
                <div className="space-y-1 px-1">
                  {HOTKEYS.map(([keys, desc]) => (
                    <div key={keys} className="flex items-center gap-3 text-xs">
                      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{keys}</kbd>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <SectionTitle>模块一览</SectionTitle>
                <div className="grid grid-cols-1 gap-1 px-1 sm:grid-cols-2">
                  {MODULES.map((m) => (
                    <div key={m.key} className="rounded border border-border px-2 py-1.5">
                      <div className="text-xs font-medium">{m.label}</div>
                      <div className="text-[10px] text-muted-foreground">{m.hint}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-1 px-1 text-[11px] leading-relaxed text-muted-foreground">
                <SectionTitle>关于 WorldForge</SectionTitle>
                <p>
                  WorldForge 世界观工坊 v{HOST_VERSION}（需求规划版）。本地优先：所有数据保存在本机
                  IndexedDB 中，不联网、不上传、无需账号。
                </p>
                <p>
                  技术栈：React + Vite + Tailwind + shadcn/ui + sql.js(SQLite WASM) + IndexedDB，
                  可打包为 Windows / 安卓 / iOS 桌面与移动应用（Tauri 2），也可作为 PWA 安装到手机桌面。
                </p>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </ModuleBody>
    </ModuleLayout>
  );
}
