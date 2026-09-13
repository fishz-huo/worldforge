/**
 * 存储持久化：查询与申请
 * ------------------------------------------------------------------
 * 「持久化存储（Persistent Storage）」是浏览器的一个开关：
 * 授予后，浏览器在磁盘紧张时**不会**自动清掉本站数据（Best-effort 变成 Persistent）。
 *
 * 关键事实（决定了 UI 该怎么说话）：
 *  - 是否授予由浏览器自己决定，**不会弹窗询问用户**；
 *    Chromium 系按「站点参与度」自动判定（装成 PWA、加书签、常访问、有通知权限会更易授予），
 *    Firefox 会弹一个「允许本站存储数据？」的提示框。
 *  - 这个开关**只影响浏览器**。桌面版（Tauri）的数据存在 WebView2 自己的数据目录里，
 *    不受浏览器清理策略影响，所以那里显示「不适用」而不是吓人的「未授予」。
 *  - 它不改变数据位置、不联网、不上传、不动系统设置，只是给存储加一个「别自动删」的标记。
 *
 * 手动申请办法（网页版）见 PERSIST_HELP，内容与 docs/使用说明.md 一致。
 */
import { isDesktop } from '@/lib/save-open';
import { storageEstimate } from '@/lib/db/idb';

/** 持久化状态：桌面端为 'n/a'（该概念不适用） */
export type PersistState = 'granted' | 'denied' | 'unsupported' | 'n/a';

/** 存储环境快照 */
export interface StorageInfo {
  desktop: boolean;
  state: PersistState;
  usage: number;
  quota: number;
}

/** 各平台的手动申请办法（UI 上折叠展示，避免吓到用户） */
export const PERSIST_HELP: { where: string; how: string }[] = [
  { where: 'Chrome / Edge（桌面）', how: '地址栏左侧的图标 → 「网站设置」→ 找到「存储」相关项；或 chrome://settings/content/all 搜本站。Chromium 通常按站点参与度自动授予，可先把本站「安装为应用」或加书签、多访问几次再点申请。' },
  { where: 'Chrome / Edge（手机）', how: '菜单 → 「添加到主屏幕」安装为 PWA，使用几次后系统会把它当常驻应用，清理时会跳过它。' },
  { where: 'Firefox', how: '点「申请持久化存储」后浏览器会弹窗询问，选「允许」即可；也可在 about:preferences#privacy → 「Cookie 和网站数据」→ 「管理例外」里查看。' },
  { where: 'Safari（macOS / iOS）', how: 'Safari 不支持这个开关；把本站「添加到主屏幕」后，iOS 对已安装的 PWA 有独立存储，不会被「清除历史记录」连带清掉。' },
  { where: '桌面版（安装包 / tauri:dev）', how: '不需要申请：数据在应用自己的数据目录里，不受浏览器清理策略影响（详见下方说明）。' },
];

/** 读取当前存储环境（用在设置页） */
export async function readStorageInfo(): Promise<StorageInfo> {
  const usage = await storageEstimate();
  const desktop = isDesktop();
  if (desktop) return { desktop, state: 'n/a', ...usage };
  const api = navigator.storage;
  if (!api?.persist || !api.persisted) return { desktop, state: 'unsupported', ...usage };
  try {
    return { desktop, state: (await api.persisted()) ? 'granted' : 'denied', ...usage };
  } catch {
    return { desktop, state: 'unsupported', ...usage };
  }
}

/** 申请持久化存储；返回申请后的状态 */
export async function requestPersistence(): Promise<PersistState> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    const ok = await navigator.storage.persist();
    return ok ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** 状态 → 一句人话（含「会不会被清掉」的结论） */
export function describePersist(info: StorageInfo): string {
  switch (info.state) {
    case 'granted':
      return '已授予：浏览器在磁盘紧张时不会自动清掉本站数据。';
    case 'denied':
      return '未授予：浏览器可能在磁盘紧张时清理本站数据（概率低，但存在）。这不会立刻发生，也不影响使用。';
    case 'unsupported':
      return '当前浏览器不支持查询或申请这个开关。建议把本站「安装为应用 / 添加到主屏幕」，并定期导出备份。';
    default:
      return '桌面版数据存在应用自己的数据目录里，不受浏览器清理策略影响 —— 这一项在桌面版不需要设置。';
  }
}

/** 数据实际存在哪里（「关于」与设置页都要用同一份说明） */
export function storageLocationHint(): string {
  return isDesktop()
    ? '当前是桌面版：数据存在 WebView2 的应用数据目录中（Windows 一般在 %LOCALAPPDATA%\\com.worldforge.desktop 下），卸载应用时才会被删除。'
    : '当前是网页版：数据存在浏览器的 IndexedDB 里（站点数据），清除浏览器数据会一并删除。';
}
