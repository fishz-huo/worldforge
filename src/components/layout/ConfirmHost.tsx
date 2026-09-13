/**
 * 应用内确认对话框的宿主组件
 * ------------------------------------------------------------------
 * 全局只挂一个（见 App.tsx）：它把「弹出并等待用户选择」注册到 lib/confirm.ts，
 * 其余模块用 `await askConfirm(...)` 即可。
 *
 * 用 ref 保存 resolve 而不是 useState：正在等待的回调不需要参与渲染，
 * 放进 state 会让组件多渲染一轮，也容易写出过期闭包。
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { registerConfirmHost, type ConfirmRequest } from '@/lib/confirm';

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => registerConfirmHost((next) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setRequest(next);
  })), []);

  /** 关闭并回传用户的选择；重复调用是安全的（resolver 只消费一次） */
  const settle = (ok: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(ok);
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && settle(false)}>
      {/* hideClose：确认框只允许「确定 / 取消」两种出口，避免 Esc 之外的第三种理解 */}
      <DialogContent className="max-w-sm" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            {request?.danger && <AlertTriangle className="size-3.5 text-destructive" />}
            {request?.danger ? '请确认（不可撤销）' : '请确认'}
          </DialogTitle>
          {/* 文案可能带换行，whitespace-pre-line 保留它 */}
          <DialogDescription className="whitespace-pre-line leading-relaxed">
            {request?.message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => settle(false)}>
            取消
          </Button>
          <Button
            variant={request?.danger ? 'destructive' : 'default'}
            size="sm"
            onClick={() => settle(true)}
          >
            {request?.confirmText ?? '确定'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
