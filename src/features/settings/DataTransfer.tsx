/**
 * 数据导出与导入
 * ------------------------------------------------------------------
 * 需求 7 / 13：本地优先意味着「数据必须能带走」。
 * 提供三种导出粒度：设定 JSON、含图片的完整备份、原始 SQLite 文件。
 *
 * 导入的三道防线（数据是软件最重要的东西，宁可啰嗦）：
 *   1. 文件能不能解析（JSON 结构 + 是不是 WorldForge 导出的）；
 *   2. 内容能不能用（inspectSnapshot：数据段是否完整、有没有卡片）；
 *   3. 确认框里把「要导入什么」和「会覆盖什么」都写清楚。
 * 真正写库时 importBackup 还包在事务里并自校验行数，失败会整体回滚。
 */
import { useState } from 'react';
import { Database, Download, HardDrive, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { exportBackupText, importBackup, lastBackupAt, markBackupDone, parseBackup } from '@/lib/backup';
import { describeBackup, explainImportError, inspectSnapshot, MAX_BACKUP_BYTES } from '@/lib/backup-inspect';
import { exportBytes, flush } from '@/lib/db';
import { formatBytes, formatTime, readFileText } from '@/lib/utils';
import { isDesktop, safeFileName, saveFile } from '@/lib/save-open';
import { useStore } from '@/store';

export function DataTransfer() {
  const worldId = useStore((s) => s.currentWorldId);
  const world = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId));
  const toast = useStore((s) => s.toast);
  const reload = useStore((s) => s.reload);
  const [busy, setBusy] = useState(false);
  const backupAt = lastBackupAt();

  /** 统一的导出收尾：把结果说清楚，用户才知道文件到底存哪了 */
  const finishExport = (outcome: Awaited<ReturnType<typeof saveFile>>, what: string) => {
    if (outcome.canceled) {
      toast('已取消导出', 'info');
      return;
    }
    if (!outcome.ok) {
      toast(`导出失败：${outcome.error ?? '未知错误'}`, 'error');
      return;
    }
    markBackupDone();
    toast(outcome.path ? `${what}已保存到：${outcome.path}` : `${what}已交给浏览器下载（位置见浏览器的下载记录）`, 'success');
  };

  const exportSettings = async () => {
    if (!worldId) return;
    setBusy(true);
    try {
      const name = safeFileName(world?.name ?? 'world');
      finishExport(await saveFile(`${name}.settings.json`, await exportBackupText(worldId, false)), '设定');
    } finally {
      setBusy(false);
    }
  };

  const exportFull = async () => {
    if (!worldId) return;
    setBusy(true);
    try {
      const name = safeFileName(world?.name ?? 'world');
      finishExport(await saveFile(`${name}.full.json`, await exportBackupText(worldId, true)), '完整备份');
    } finally {
      setBusy(false);
    }
  };

  const exportSqlite = async () => {
    if (!worldId) return;
    setBusy(true);
    try {
      await flush();
      const name = safeFileName(world?.name ?? 'world');
      finishExport(await saveFile(`${name}.sqlite`, exportBytes(), 'application/octet-stream'), 'SQLite 数据库');
    } finally {
      setBusy(false);
    }
  };

  /** 导入备份（覆盖当前世界观内容，失败整体回滚） */
  const importFile = async (file: File) => {
    if (!worldId) return;
    if (file.size > MAX_BACKUP_BYTES) {
      toast(`文件太大（${formatBytes(file.size)}），上限 ${formatBytes(MAX_BACKUP_BYTES)}`, 'error');
      return;
    }
    const backup = parseBackup(await readFileText(file));
    if (!backup) {
      toast('文件格式不正确：需要 WorldForge 导出的 JSON 备份', 'error');
      return;
    }
    const inspection = inspectSnapshot(backup.snapshot, backup.assets?.length ?? 0);
    if (!inspection.ok) {
      toast(`这份备份不可用：${inspection.problems.join('；')}`, 'error');
      return;
    }
    const now = { cards: useStore.getState().cards.length, maps: useStore.getState().maps.length };
    const ok = confirm(
      `即将导入：${describeBackup(inspection)}\n\n` +
      `导入会覆盖当前世界观「${world?.name ?? '未命名'}」的全部内容` +
      `（现有 ${now.cards} 张卡片、${now.maps} 张地图会被替换，此操作不可撤销）。\n\n` +
      '确定继续？',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const result = await importBackup(worldId, backup);
      reload();
      toast(`导入完成：${inspection.stats.cards} 张卡片、${inspection.stats.relations} 条关联` +
        (result.assets > 0 ? `、${result.assets} 张图片` : ''), 'success');
    } catch (err) {
      toast(explainImportError(err), 'error');
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
          <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" disabled={busy} onClick={exportSqlite}>
            <HardDrive className="size-3.5" /> 导出 SQLite 原始数据库
          </Button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {isDesktop()
              ? '桌面版会弹出系统「另存为」对话框，可以自己选目录与文件名。'
              : '网页版的保存位置由浏览器决定（默认下载目录），可在浏览器设置里改，或在下载时选择「另存为」。'}
          </p>
          {backupAt > 0 && <p className="text-[10px] text-muted-foreground">上次导出：{formatTime(backupAt)}</p>}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>导入</SectionTitle>
        <div className="px-1">
          <label className="inline-flex">
            <input
              type="file"
              accept=".json,application/json"
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
            导入前会先检查文件内容，写入失败会整体回滚，不会留下半套数据。
          </p>
        </div>
      </section>
    </>
  );
}
