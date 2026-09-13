/**
 * 版本模块
 * ------------------------------------------------------------------
 * 需求 12：设定版本切换对比。
 * 左侧是所有快照；选中一个即刻与「当前设定」做结构化对比；
 * 也可以把某个快照整体还原（会二次确认，因为还原会覆盖当前内容）。
 */
import { useMemo } from 'react';
import { Camera, Download, GitBranch, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { SidePanel, ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { SnapshotDiffView } from './SnapshotDiffView';
import { diffSnapshots } from '@/lib/snapshot-diff';
import { buildSnapshot, parseSnapshot } from '@/lib/snapshot';
import { downloadText, formatBytes, formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { askConfirm } from '@/lib/confirm';

export function VersionsModule() {
  const versions = useStore((s) => s.versions);
  const selectedVersionId = useStore((s) => s.selectedVersionId);
  const selectVersion = useStore((s) => s.selectVersion);
  const createVersion = useStore((s) => s.createVersion);
  const deleteVersion = useStore((s) => s.deleteVersion);
  const restoreVersion = useStore((s) => s.restoreVersion);
  const versionToJson = useStore((s) => s.versionToJson);
  const worldId = useStore((s) => s.currentWorldId);

  const selected = versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;

  /** 当前设定快照（用于对比） */
  const current = useMemo(() => (worldId ? buildSnapshot(worldId) : null), [worldId, versions, selectedVersionId]);
  const diff = useMemo(() => {
    if (!selected || !current) return null;
    const payload = parseSnapshot(selected.snapshot);
    return payload ? diffSnapshots(payload, current) : null;
  }, [selected, current]);

  return (
    <ModuleLayout>
      <SidePanel
        title="设定版本"
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            title="保存当前设定为快照"
            onClick={() => createVersion(`快照 ${new Date().toLocaleString('zh-CN')}`)}
          >
            <Camera />
          </Button>
        }
      >
        <div className="space-y-2 p-2">
          <Button className="w-full gap-1.5" size="sm" onClick={() => createVersion(`快照 ${new Date().toLocaleString('zh-CN')}`)}>
            <Camera className="size-3.5" /> 保存当前设定为版本
          </Button>
          <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
            快照包含卡片、标签、关联、地图、时间轴与文稿。图片二进制不进快照，因此体积很小。
          </p>

          <SectionTitle>{versions.length} 个版本</SectionTitle>
          <div className="space-y-0.5">
            {versions.map((v) => (
              <div
                key={v.id}
                className={cn(
                  'group rounded px-2 py-1.5 transition-colors',
                  v.id === selected?.id ? 'bg-primary/15 text-primary' : 'hover:bg-accent',
                )}
              >
                <button onClick={() => selectVersion(v.id)} className="flex w-full items-start gap-1.5 text-left">
                  <GitBranch className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{v.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {formatTime(v.created_at)} · {formatBytes(v.size)}
                    </span>
                    {v.note && <span className="block truncate text-[10px] text-muted-foreground">{v.note}</span>}
                  </span>
                </button>
                <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 flex-1 gap-1 text-[10px]"
                    onClick={async () => {
                      if (await askConfirm(`用「${v.name}」覆盖当前设定？当前未保存的改动会丢失。`)) restoreVersion(v.id);
                    }}
                  >
                    <RotateCcw className="size-3" /> 还原
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 text-[10px]"
                    onClick={async () => {
                      const json = versionToJson(v.id);
                      if (json) downloadText(`${v.name}.snapshot.json`, json);
                    }}
                  >
                    <Download className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-destructive"
                    onClick={async () => {
                      if (await askConfirm(`删除版本「${v.name}」？`)) deleteVersion(v.id);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
            {versions.length === 0 && (
              <div className="px-1 py-2 text-[11px] leading-relaxed text-muted-foreground">
                还没有快照。建议在每次大改设定之前先存一个版本，之后就能对比出差在哪。
              </div>
            )}
          </div>
        </div>
      </SidePanel>

      <ModuleBody>
        {!selected ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            先在左侧保存一个版本
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
              <span className="font-medium">{selected.name}</span>
              <span className="text-muted-foreground">vs 当前设定</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{formatTime(selected.created_at)}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {diff ? (
                <SnapshotDiffView diff={diff} />
              ) : (
                <div className="p-4 text-xs text-muted-foreground">快照解析失败，可能已损坏。</div>
              )}
            </div>
          </div>
        )}
      </ModuleBody>
    </ModuleLayout>
  );
}
