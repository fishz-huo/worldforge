/**
 * 轻提示容器
 * ------------------------------------------------------------------
 * 所有 toast（包括插件调用 api.toast）都渲染在右下角。
 */
import { AlertTriangle, Check, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

const ICONS = {
  info: Info,
  success: Check,
  warn: AlertTriangle,
  error: XCircle,
} as const;

const STYLES = {
  info: 'border-border',
  success: 'border-emerald-500/40',
  warn: 'border-amber-500/40',
  error: 'border-destructive/50',
} as const;

export function ToastHost() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-10 right-3 z-[60] flex w-72 flex-col gap-1.5">
      {toasts.map((t) => {
        const Ico = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-md border bg-popover/95 p-2 text-xs shadow-lg backdrop-blur animate-fade-in',
              STYLES[t.kind],
            )}
          >
            <Ico
              className={cn(
                'mt-0.5 size-3.5 shrink-0',
                t.kind === 'success' && 'text-emerald-400',
                t.kind === 'warn' && 'text-amber-400',
                t.kind === 'error' && 'text-destructive',
                t.kind === 'info' && 'text-muted-foreground',
              )}
            />
            <span className="min-w-0 flex-1 break-words leading-relaxed">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
