/**
 * 世界观 / 平行世界 相关对话框
 * ------------------------------------------------------------------
 * 从 WorldSwitcher 拆出来，让下拉菜单的代码只关心「菜单」。
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useStore } from '@/store';

/** 新建平行世界 / 从当前分支派生 */
export function BranchDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'fork';
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const createBranch = useStore((s) => s.createBranch);
  const forkBranch = useStore((s) => s.forkBranch);

  const submit = () => {
    if (!name.trim()) return;
    if (mode === 'create') createBranch(name.trim(), note);
    else forkBranch(name.trim(), note);
    setName('');
    setNote('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建平行世界' : '从当前分支派生'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label>分支名称</Label>
            <Input
              autoFocus
              value={name}
              placeholder={mode === 'create' ? '例如：if 线 · 主角未觉醒' : '例如：if 线 · 薇拉战死'}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="space-y-1">
            <Label>{mode === 'create' ? '设定说明' : '分歧点描述'}</Label>
            <Textarea
              value={note}
              className="min-h-[72px]"
              placeholder="与主世界的分歧在哪里？例如：第 245 年，烬关之战中主角拒绝点燃灵脉"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {mode === 'fork' && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              派生会把当前分支可见的卡片复制一份到新分支，之后两边可以独立修改，互不影响。
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={submit} disabled={!name.trim()}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 新建世界观体系 */
export function NewWorldDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState('');
  const createWorld = useStore((s) => s.createWorld);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>新建世界观体系</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label>名称</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：星海纪元"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                createWorld(name.trim());
                setName('');
                onOpenChange(false);
              }
            }}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            一个世界观体系可以包含多条平行世界分支，各自拥有独立的卡片、地图与时间轴。
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              createWorld(name.trim());
              setName('');
              onOpenChange(false);
            }}
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
