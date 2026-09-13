/**
 * 数据设置
 * ------------------------------------------------------------------
 * 需求 7 / 13：本地优先、数据可带走。
 * 这里负责存储状态与危险操作；导出导入见 DataTransfer.tsx，
 * 持久化存储的判断与文案见 lib/storage-persist.ts。
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { purgeEverything } from '@/lib/db/purge';
import { formatBytes } from '@/lib/utils';
import {
  describePersist, PERSIST_HELP, readStorageInfo, requestPersistence,
  storageLocationHint, type StorageInfo,
} from '@/lib/storage-persist';
import { useStore } from '@/store';
import { DataTransfer } from './DataTransfer';
import { askConfirm } from '@/lib/confirm';

export function DataSettings() {
  const toast = useStore((s) => s.toast);
  const reseedDemo = useStore((s) => s.reseedDemo);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    void readStorageInfo().then(setInfo);
  }, []);

  const applyRequest = async () => {
    const state = await requestPersistence();
    setInfo((prev) => (prev ? { ...prev, state } : prev));
    toast(
      state === 'granted' ? '已获得持久化存储授权' : '浏览器没有授予（这不是错误）—— 见下方「怎么才能拿到授权」',
      state === 'granted' ? 'success' : 'warn',
    );
  };

  return (
    <div className="space-y-4">
      <DataTransfer />

      <section className="space-y-2">
        <SectionTitle>
          <span className="flex items-center gap-1">
            <HardDrive className="size-3" /> 本地存储
          </span>
        </SectionTitle>
        <div className="space-y-1.5 px-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">已用空间</span>
            <span>{formatBytes(info?.usage ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">可用配额</span>
            <span>{info?.quota ? formatBytes(info.quota) : '未知'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">持久化存储</span>
            <span>
              {info === null ? '查询中…'
                : info.state === 'granted' ? '已授予'
                  : info.state === 'denied' ? '未授予'
                    : info.state === 'n/a' ? '桌面版不适用' : '当前浏览器不支持'}
            </span>
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">{info && describePersist(info)}</p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{storageLocationHint()}</p>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {info && info.state === 'denied' && (
              <Button variant="outline" size="sm" onClick={() => void applyRequest()}>
                申请持久化存储
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowHelp((v) => !v)}>
              {showHelp ? '收起说明' : '怎么才能拿到授权？'}
            </Button>
          </div>

          {showHelp && (
            <div className="space-y-1.5 rounded-md border border-border p-2">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                这个开关只做一件事：告诉浏览器<strong>别在磁盘紧张时自动删掉本站数据</strong>。
                它不会改变数据存放位置、不联网、不上传、不改系统设置，对电脑本身没有副作用。
                授予与否由浏览器决定（多数浏览器不弹窗，而是按「你是否常用这个站点」自动判断）。
              </p>
              {PERSIST_HELP.map((row) => (
                <p key={row.where} className="text-[10px] leading-relaxed text-muted-foreground">
                  · <strong>{row.where}</strong>：{row.how}
                </p>
              ))}
              <p className="text-[10px] leading-relaxed text-amber-400">
                最稳的保障仍然是<strong>导出备份</strong>：定期「导出完整备份」到自己的文件夹，
                就算浏览器清了数据，也能一键导入回来。
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="size-3" /> 危险操作
          </span>
        </SectionTitle>
        <div className="space-y-1.5 px-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-1.5"
            onClick={async () => {
              if (await askConfirm('重建示例数据会先删除当前世界观，确定继续？')) reseedDemo();
            }}
          >
            <RefreshCw className="size-3.5" /> 重建示例世界观
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-1.5 text-destructive"
            onClick={async () => {
              if (!await askConfirm('这会清空本机上全部世界观数据（插件与设置保留），且无法撤销。\n建议先「导出完整备份」。确定继续？')) return;
              purgeEverything();
              toast('已清空全部数据，正在重新初始化…', 'warn');
              setTimeout(() => window.location.reload(), 600);
            }}
          >
            <AlertTriangle className="size-3.5" /> 清空全部数据
          </Button>
        </div>
      </section>
    </div>
  );
}
