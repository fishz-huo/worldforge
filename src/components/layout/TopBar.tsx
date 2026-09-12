/**
 * 顶栏
 * ------------------------------------------------------------------
 * 收纳全局操作：模块标题、全局搜索、面板显隐、专注模式、主题、命令面板。
 * 「隐藏不需要的部分」的所有开关都集中在这里，位置固定符合直觉。
 */
import { Moon, PanelLeft, PanelRight, Search, Sun, Terminal, Focus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { moduleOf } from './modules';

export function TopBar() {
  const module = useStore((s) => s.module);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const inspectorOpen = useStore((s) => s.inspectorOpen);
  const setInspectorOpen = useStore((s) => s.setInspectorOpen);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const toggleFocus = useStore((s) => s.toggleFocus);
  const focusMode = useStore((s) => s.focusMode);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const branchScope = useStore((s) => s.branchScope);
  const setBranchScope = useStore((s) => s.setBranchScope);

  const def = moduleOf(module);
  /** 搜索框在总览 / 设置 / 插件页没有意义，自动隐藏 */
  const showSearch = !['board', 'plugins', 'settings'].includes(module);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card/40 px-2">
      <div className="flex items-center gap-2 pl-1">
        <span className="text-sm font-semibold tracking-wide">WorldForge</span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">v0.1</span>
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
        <span className="hidden items-center gap-1 text-xs font-medium sm:flex">
          {def.label}
          <span className="text-[11px] font-normal text-muted-foreground">· {def.hint}</span>
        </span>
      </div>

      {showSearch && (
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题 / 摘要 / 正文 / 字段…"
            className="h-7 pl-7 pr-7 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      <div className={cn('flex items-center gap-0.5', !showSearch && 'ml-auto')}>
        <Hint label={branchScope === 'current' ? '当前分支视图（点击查看全部平行世界）' : '全部平行世界视图'}>
          <Button
            variant={branchScope === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="hidden lg:inline-flex"
            onClick={() => setBranchScope(branchScope === 'current' ? 'all' : 'current')}
          >
            {branchScope === 'current' ? '当前分支' : '全部分支'}
          </Button>
        </Hint>
        <Hint label="侧栏 (Ctrl+B)">
          <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <PanelLeft className={cn(!sidebarOpen && 'opacity-50')} />
          </Button>
        </Hint>
        <Hint label="检查器 (Ctrl+I)">
          <Button variant="ghost" size="icon-sm" onClick={() => setInspectorOpen(!inspectorOpen)}>
            <PanelRight className={cn(!inspectorOpen && 'opacity-50')} />
          </Button>
        </Hint>
        <Hint label={focusMode ? '退出专注模式 (Ctrl+\\)' : '专注模式 (Ctrl+\\)'}>
          <Button variant={focusMode ? 'secondary' : 'ghost'} size="icon-sm" onClick={toggleFocus}>
            <Focus />
          </Button>
        </Hint>
        <Hint label={theme === 'dark' ? '切换到亮色' : '切换到暗色'}>
          <Button variant="ghost" size="icon-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </Hint>
        <Hint label="命令面板 (Ctrl+K)">
          <Button variant="ghost" size="icon-sm" onClick={() => setPaletteOpen(true)}>
            <Terminal />
          </Button>
        </Hint>
      </div>
    </header>
  );
}
