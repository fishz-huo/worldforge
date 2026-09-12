/**
 * 数据导出与导入
 * ------------------------------------------------------------------
 * 需求 7 / 13：本地优先意味着「数据必须能带走」。
 * 提供三种导出粒度：设定 JSON、含图片的完整备份、原始 SQLite 文件。
 */
import { useState } from 'react';
import { Database, Download, HardDrive, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { exportBackupText, importBackup, lastBackupAt, markBackupDone, parseBackup } from '@/lib/backup';
import { exportBytes, flush } from '@/lib/db';
import { downloadText, formatTime, readFileText } from '@/lib/utils';
import { useStore } from '@/store';

export function DataTransfer() {
  const worldId = useStore((s) => s.currentWorldId);
  const world = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId));
  const toast = useStore((s) => s.toast);
  const reload = useStore((s) => s.reload);
  const [busy, setBusy] = useState(false);
  const backupAt = lastBackupAt();

  /** 导出设定（不含图片） */
  const exportSettings = async () => {
    if (!worldId) return;
    setBusy(true);
    try {
      downloadText(`${world?.name ?? 'world'}.settings.json`, await exportBackupText(worldId, false));
      markBackupDone();
      toast('设定已导出', 'success');
    } finally {
      setBusy(false);
    }
  };

  /** 导出完整备份（含图片，体积较大） */
  const exportFull = async () => {
    if (!worldId) return;
    setBusy(true);
    try {
      downloadText(`${world?.name ?? 'world'}.full.json`, await exportBackupText(worldId, true));
      markBackupDone();
      toast('完整备份已导出（含图片）', 'success');
    } finally {
      setBusy(false);
    }
  };

  /** 导出 SQLite 原始文件（可用任何 SQLite 工具打开） */
  const exportSqlite = async () => {
    await flush();
    const bytes = exportBytes();
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${world?.name ?? 'world'}.sqlite`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出 SQLite 数据库文件', 'success');
  };

  /** 导入备份（覆盖当前世界观内容） */
  const importFile = async (file: File) => {
    if (!worldId) return;
    const backup = parseBackup(await readFileText(file));
    if (!backup) {
      toast('文件格式不正确，需要 WorldForge 导出的 JSON', 'error');
      return;
    }
    if (!confirm(`导入将覆盖当前世界观「${world?.name}」的全部设定内容，确定继续？`)) return;
    setBusy(true);
    try {
      const result = await importBackup(worldId, backup);
      reload();
      toast(`导入完成（含 ${result.assets} 张图片）`, 'success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="space-y-2">
        <SectionTitle>
          <span className="flex items-center gap-1">
            <Database className="size-3" /> 导出
          </span>
        </SectionTitle>
        <div className="space-y-1.5 px-1">
          <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" disabled={busy} onClick={exportSettings}>
            <Download className="size-3.5" /> 导出设定（JSON，不含图片）
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" disabled={busy} onClick={exportFull}>
            <Download className="size-3.5" /> 导出完整备份（含图片，体积较大）
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" onClick={exportSqlite}>
            <HardDrive className="size-3.5" /> 导出 SQLite 原始数据库
          </Button>
          {backupAt > 0 && <p className="text-[10px] text-muted-foreground">上次导出：{formatTime(backupAt)}</p>}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>导入</SectionTitle>
        <div className="px-1">
          <label className="inline-flex">
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
            />
            <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent">
              <Upload className="size-3.5" /> 选择备份文件导入
            </span>
          </label>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            导入会覆盖当前世界观的卡片、地图、时间轴与文稿（图片按其 id 合并）。
          </p>
        </div>
      </section>
    </>
  );
}
