/**
 * 世界观 / 平行世界切换器
 * ------------------------------------------------------------------
 * 需求 8：在一套世界观体系下可以调出对应的平行世界设定。
 * 下拉菜单承担：切换世界观、切换分支、新建、派生（fork）、删除。
 * 两个对话框见 WorldDialogs.tsx。
 */
import { useState } from 'react';
import { Check, ChevronsUpDown, GitBranch, Globe2, Plus, Trash2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dot } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { BranchDialog, NewWorldDialog } from './WorldDialogs';
import { askConfirm } from '@/lib/confirm';

export function WorldSwitcher({ compact = false }: { compact?: boolean }) {
  const worlds = useStore((s) => s.worlds);
  const branches = useStore((s) => s.branches);
  const worldId = useStore((s) => s.currentWorldId);
  const branchId = useStore((s) => s.currentBranchId);
  const switchWorld = useStore((s) => s.switchWorld);
  const switchBranch = useStore((s) => s.switchBranch);
  const deleteWorld = useStore((s) => s.deleteWorld);
  const deleteBranch = useStore((s) => s.deleteBranch);
  const [branchDialog, setBranchDialog] = useState<'create' | 'fork' | null>(null);
  const [worldDialog, setWorldDialog] = useState(false);

  const world = worlds.find((w) => w.id === worldId);
  const branch = branches.find((b) => b.id === branchId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent',
              compact && 'justify-center',
            )}
            title={world ? `${world.name}${branch ? ` / ${branch.name}` : ' / 主世界'}` : '选择世界观'}
          >
            <Globe2 className="size-4 shrink-0 text-primary" />
            {!compact && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{world?.name ?? '未选择'}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <GitBranch className="size-2.5" />
                    {branch ? branch.name : '主世界'}
                  </span>
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>世界观体系</DropdownMenuLabel>
          {worlds.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => switchWorld(w.id)} className="justify-between">
              <span className="flex min-w-0 items-center gap-1.5">
                <Globe2 className="size-3.5" />
                <span className="truncate">{w.name}</span>
              </span>
              {w.id === worldId && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => setWorldDialog(true)}>
            <Plus className="size-3.5" /> 新建世界观
          </DropdownMenuItem>
          {worlds.length > 1 && worldId && (
            <DropdownMenuItem
              className="text-destructive"
              onSelect={async () => {
                if (await askConfirm(`确定删除世界观「${world?.name}」？其全部卡片、地图与文稿都会被移除。`)) {
                  deleteWorld(worldId);
                }
              }}
            >
              <Trash2 className="size-3.5" /> 删除当前世界观
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>平行世界分支</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => switchBranch(null)} className="justify-between">
            <span className="flex items-center gap-1.5">
              <Dot color="#64748b" /> 主世界（基准设定）
            </span>
            {branchId === null && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
          {branches.map((b) => (
            <DropdownMenuItem key={b.id} onSelect={() => switchBranch(b.id)} className="justify-between">
              <span className="flex min-w-0 items-center gap-1.5">
                <Dot color={b.color} />
                <span className="truncate">{b.name}</span>
              </span>
              <span className="flex items-center gap-1">
                {b.id === branchId && <Check className="size-3.5 text-primary" />}
                <button
                  className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (await askConfirm(`删除分支「${b.name}」？该分支独有的卡片会被移除。`)) deleteBranch(b.id);
                  }}
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setBranchDialog('create')}>
            <Plus className="size-3.5" /> 新建平行世界
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setBranchDialog('fork')}>
            <GitBranch className="size-3.5" /> 从当前分支派生
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BranchDialog
        open={branchDialog !== null}
        mode={branchDialog ?? 'create'}
        onOpenChange={(v) => !v && setBranchDialog(null)}
      />
      <NewWorldDialog open={worldDialog} onOpenChange={setWorldDialog} />
    </>
  );
}
