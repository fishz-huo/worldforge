/**
 * 大纲标题色块
 * ------------------------------------------------------------------
 * 底色只覆盖文字本身：换行的长标题里，每一行片段各自带底色，
 * 而不是把整行铺满（靠 outlineStatus 里的 box-decoration-clone）。
 * 色号全部来自 outlineStatus，这里只负责排版。
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { statusStyle } from './outlineStatus';

export function OutlineStatusChip({
  status,
  children,
  className,
  title,
}: {
  status: string | undefined;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className={cn(statusStyle(status).chip, className)}>
      {children}
    </span>
  );
}
