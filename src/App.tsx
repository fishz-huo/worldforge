/**
 * 应用根组件
 * ------------------------------------------------------------------
 * 职责：启动状态门禁、主题变量应用、全局快捷键、整体骨架。
 */
import { useEffect, useMemo } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { ConfirmHost } from '@/components/layout/ConfirmHost';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { useHotkeys } from '@/hooks/useHotkeys';
import { usePluginRegistry } from '@/hooks/usePluginRegistry';
import { flush } from '@/lib/db';
import { MODULES } from '@/components/layout/modules';
import { useStore } from '@/store';

/** 启动加载页 */
function LoadingScreen({ error }: { error: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="text-lg font-semibold tracking-wide">WorldForge 世界观工坊</div>
      {error ? (
        <div className="max-w-md rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          初始化失败：{error}
          <div className="mt-2 text-muted-foreground">
            请尝试刷新页面；若持续失败，可在浏览器设置中清除本站点数据后重试。
          </div>
        </div>
      ) : (
        <>
          <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
          <div className="text-xs text-muted-foreground">正在装载本地数据库…</div>
        </>
      )}
    </div>
  );
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const theme = useStore((s) => s.theme);
  const accent = useStore((s) => s.accent);
  const registry = usePluginRegistry();

  /** 应用主题：明暗类名 + 强调色 + 插件注册的配色变量 */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.setProperty('--primary', accent);
    root.style.setProperty('--ring', accent);
    // 插件主题：最后注册的、模式匹配的主题生效
    const match = registry.themes.filter((t) => t.mode === theme).pop();
    if (match) Object.entries(match.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [theme, accent, registry.themes]);

  /** 全局快捷键 */
  const hotkeys = useMemo(() => {
    const state = () => useStore.getState();
    const map: Record<string, () => void> = {
      'mod+k': () => state().setPaletteOpen(!state().paletteOpen),
      'mod+s': () => void flush().then(() => state().toast('已保存到本地', 'success')),
      'mod+\\': () => state().toggleFocus(),
      'mod+b': () => state().setSidebarOpen(!state().sidebarOpen),
      'mod+i': () => state().setInspectorOpen(!state().inspectorOpen),
      escape: () => {
        state().setPaletteOpen(false);
        state().setSearch('');
      },
    };
    // 数字键直接跳模块，减少鼠标移动
    MODULES.slice(0, 9).forEach((m, i) => {
      map[String(i + 1)] = () => state().setModule(m.key);
    });
    return map;
  }, []);
  useHotkeys(hotkeys, ready);

  if (!ready) return <LoadingScreen error="" />;
  if (error) return <LoadingScreen error={error} />;

  return (
    <TooltipProvider delayDuration={200}>
      {/* 最外层兜底：万一骨架自身出错，也要给出可读提示而不是白屏 */}
      <ErrorBoundary label="应用界面">
        <AppShell />
        {/* 全局确认对话框：所有删除/清空操作都走它（替代桌面版会报错的 window.confirm） */}
        <ConfirmHost />
      </ErrorBoundary>
    </TooltipProvider>
  );
}
