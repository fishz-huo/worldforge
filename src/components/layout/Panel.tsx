/**
 * 模块内容区的布局外壳
 * ------------------------------------------------------------------
 * 三栏布局（次级侧栏 + 内容 + 检查器）里的"内容"那一半：
 *   - ModuleLayout  横向排列容器，把三块并排放好；
 *   - ModuleBody    主内容区，占满剩余宽度。
 *
 * 侧栏与检查器本身（含移动端抽屉的规则）在 SidePanel.tsx；
 * 这里在文件末尾把它们的类型与组件**原样转出去**，
 * 所以既有代码继续写 `import { SidePanel } from '@/components/layout/Panel'`
 * 就能用，不必改二十多个调用点。
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type { PanelProps } from './SidePanel';
export { SidePanel, InspectorPanel } from './SidePanel';

/** 模块内容区通用容器：负责三栏布局与滚动 */
export function ModuleLayout({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 w-full">{children}</div>;
}

/** 主内容区（自动占满剩余宽度） */
export function ModuleBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', className)}>{children}</div>;
}
