/**
 * 业务无关的通用展示组件（自定义，非 shadcn 原生）
 * ------------------------------------------------------------------
 * 空状态、进度条、区块标题、键值行等，减少各模块重复样板代码。
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 空状态占位 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-10 text-center', className)}>
      {icon && <div className="text-muted-foreground/60 [&_svg]:size-7">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</div>}
      {action}
    </div>
  );
}

/** 细进度条 */
export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full bg-primary transition-[width]', barClassName)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** 侧栏区块标题 */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      {right}
    </div>
  );
}

/** 键值行（详情面板里大量使用） */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-start gap-2 py-1">
      <span className="pt-0.5 text-[11px] text-muted-foreground">{label}</span>
      <div className="min-w-0 text-xs">{children}</div>
    </div>
  );
}

/** 色点 */
export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: color }} />;
}
