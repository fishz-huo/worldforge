/**
 * 数据设置
 * ------------------------------------------------------------------
 * 需求 7 / 13：本地优先、数据可带走。
 * 这里负责存储状态与危险操作；导出导入见 DataTransfer.tsx。
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { storageEstimate, requestPersistentStorage } from '@/lib/db/idb';
import { purgeEverything } from '@/lib/db/purge';
import { formatBytes } from '@/lib/utils';
import { useStore } from '@/store';
import { DataTransfer } from './DataTransfer';

export function DataSettings() {
  const toast = useStore((s) => s.toast);
  const reseedDemo = useStore((s) => s.reseedDemo);
  const [usage, setUsage] = useState({ usage: 0, quota: 0 });
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void storageEstimate().then(setUsage);
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  return (
    <div className="space-y-4">
      <DataTransfer />

      <section className="space-y-2">
        <SectionTitle>
          <span className="flex items-center gap-1">
            <HardDrive className="size-3" /> 本地存储
          </span>
        </SectionTitle>
        <div className="space-y-1 px-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">已用空间</span>
            <span>{formatBytes(usage.usage)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">浏览器配额</span>
            <span>{usage.quota ? formatBytes(usage.quota) : '未知'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">持久化存储</span>
            <span>{persisted === null ? '不支持查询' : persisted ? '已授予' : '未授予'}</span>
          </div>
          {persisted === false && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1 w-full"
              onClick={async () => {
                const ok = await requestPersistentStorage();
                setPersisted(ok);
                toast(ok ? '已获得持久化存储授权' : '浏览器未授予，数据可能被自动清理', ok ? 'success' : 'warn');
              }}
            >
              申请持久化存储（避免被自动清理）
            </Button>
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
            onClick={() => {
              if (confirm('重建示例数据会先删除当前世界观，确定继续？')) reseedDemo();
            }}
          >
            <RefreshCw className="size-3.5" /> 重建示例世界观
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-1.5 text-destructive"
            onClick={() => {
              if (!confirm('这会清空本机上全部世界观数据（插件与设置保留），且无法撤销。确定继续？')) return;
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
