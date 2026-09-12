/**
 * 底部状态栏
 * ------------------------------------------------------------------
 * 本地优先软件最重要的是「我的东西存下来了吗」：
 * 这里实时显示保存状态、数据规模与当前世界观/分支。
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Cloud, Loader2 } from 'lucide-react';
import { getSaveState, onSaveStatus, type SaveStatus } from '@/lib/db';
import { relativeTime } from '@/lib/utils';
import { useStore } from '@/store';

export function StatusBar() {
  const [status, setStatus] = useState<SaveStatus>(getSaveState().status);
  const [at, setAt] = useState<number>(getSaveState().lastSavedAt);
  const [err, setErr] = useState<string>('');
  const cards = useStore((s) => s.cards);
  const relations = useStore((s) => s.relations);
  const maps = useStore((s) => s.maps);
  const worlds = useStore((s) => s.worlds);
  const branches = useStore((s) => s.branches);
  const worldId = useStore((s) => s.currentWorldId);
  const branchId = useStore((s) => s.currentBranchId);
  const focusMode = useStore((s) => s.focusMode);

  useEffect(() => onSaveStatus((s, savedAt, error) => {
    setStatus(s);
    setAt(savedAt);
    setErr(error);
  }), []);

  if (focusMode) return null;

  const world = worlds.find((w) => w.id === worldId);
  const branch = branches.find((b) => b.id === branchId);

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-card/40 px-2 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        {status === 'saving' && <Loader2 className="size-3 animate-spin" />}
        {status === 'error' && <AlertTriangle className="size-3 text-destructive" />}
        {status === 'saved' && <Check className="size-3 text-emerald-400" />}
        {(status === 'idle' || !status) && <Cloud className="size-3" />}
        {status === 'saving'
          ? '正在写入本地…'
          : status === 'error'
            ? `保存失败：${err}`
            : at
              ? `已保存 · ${relativeTime(at)}`
              : '本地优先 · 数据仅存于本机'}
      </span>
      <span className="hidden sm:inline">卡片 {cards.length}</span>
      <span className="hidden sm:inline">关联 {relations.length}</span>
      <span className="hidden md:inline">地图 {maps.length}</span>
      <span className="ml-auto truncate">
        {world?.name ?? '—'}
        {branch ? ` / ${branch.name}` : ' / 主世界'}
      </span>
    </footer>
  );
}
