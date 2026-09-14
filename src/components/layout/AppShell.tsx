/**
 * 应用骨架
 * ------------------------------------------------------------------
 * 布局：顶栏 + [图标栏 | 主内容区] + 状态栏。
 * 每个业务模块在自己的内容区里渲染 SidePanel / InspectorPanel，
 * 面板显隐统一由 store 的 sidebarOpen / inspectorOpen 控制，
 * 因此「隐藏不需要的部分，需要时一键调出」在全应用内是一致的。
 */
import type { ComponentType } from 'react';
import { useStore } from '@/store';
import type { ModuleKey } from '@/store/types';
import { SideRail } from './SideRail';
import { useAutoCollapseDrawers } from './panel-tools';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { ToastHost } from './ToastHost';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { moduleOf } from './modules';
import { BoardModule } from '@/features/board/BoardModule';
import { CardsModule } from '@/features/cards/CardsModule';
import { MapModule } from '@/features/map/MapModule';
import { TimelineModule } from '@/features/timeline/TimelineModule';
import { WriterModule } from '@/features/writer/WriterModule';
import { OutlineModule } from '@/features/outline/OutlineModule';
import { VersionsModule } from '@/features/versions/VersionsModule';
import { PluginsModule } from '@/features/plugins/PluginsModule';
import { SettingsModule } from '@/features/settings/SettingsModule';

/** 模块 → 视图组件 */
const VIEWS: Record<ModuleKey, ComponentType> = {
  board: BoardModule,
  cards: CardsModule,
  map: MapModule,
  timeline: TimelineModule,
  writer: WriterModule,
  outline: OutlineModule,
  versions: VersionsModule,
  plugins: PluginsModule,
  settings: SettingsModule,
};

export function AppShell() {
  const module = useStore((s) => s.module);
  const View = VIEWS[module] ?? BoardModule;
  // 窗口跨过 1024px 断点时把左右两栏收起来，避免两个浮层同时盖住内容
  useAutoCollapseDrawers();

  return (
    /*
      底部留出移动端标签栏的高度：标签栏是 fixed 的，如果不留，
      状态栏与内容区最后一行会被它盖住（手机上表现为"最下面那行点不到"）。
      桌面端 --wf-bottom-nav 为 0，所以这一条对桌面完全无影响。
    */
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      style={{ paddingBottom: 'var(--wf-bottom-nav)' }}
    >
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <SideRail />
        <main className="min-w-0 flex-1 overflow-hidden">
          {/* 边界只包住内容区：即使某个模块崩了，顶栏与图标栏仍然可用，
              用户能直接切到别的模块，而不是对着白屏重启应用。
              key={module} 让边界在切换模块时重置，不留着上一块的错误面板。 */}
          <ErrorBoundary key={module} label={`「${moduleOf(module).label}」模块`}>
            <View />
          </ErrorBoundary>
        </main>
      </div>
      <StatusBar />
      <ToastHost />
      <CommandPalette />
    </div>
  );
}
