/**
 * 通用工具函数
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind 类名合并（shadcn/ui 约定） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 无操作函数 */
export const noop = () => {};

/** 数值区间裁剪 */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** 深拷贝（结构化克隆，支持纯数据对象） */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 防抖 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  wrapped.flush = (...args: A) => {
    wrapped.cancel();
    fn(...args);
  };
  return wrapped;
}

/** 节流（requestAnimationFrame 版，用于拖拽等高频事件） */
export function rafThrottle<A extends unknown[]>(fn: (...args: A) => void) {
  let scheduled = false;
  let lastArgs: A;
  return (...args: A) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn(...lastArgs);
    });
  };
}

/** 格式化时间戳为本地时间文本 */
export function formatTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 相对时间描述 */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  if (diff < min) return '刚刚';
  if (diff < 60 * min) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))} 小时前`;
  if (diff < 30 * 24 * 60 * min) return `${Math.floor(diff / (24 * 60 * min))} 天前`;
  return formatTime(ts).slice(0, 10);
}

/** 人类可读的字节数 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 按关键词做模糊匹配（忽略大小写，支持中文子串） */
export function matches(query: string, ...texts: (string | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return texts.some((t) => (t ?? '').toLowerCase().includes(q));
}

/** 数组按 key 分组 */
export function groupBy<T, K extends string>(list: T[], keyOf: (item: T) => K): Record<K, T[]> {
  return list.reduce((acc, item) => {
    const k = keyOf(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/** 稳定的数值排序比较器 */
export function byNumber<T>(keyOf: (item: T) => number, dir: 'asc' | 'desc' = 'asc') {
  return (a: T, b: T) => (dir === 'asc' ? keyOf(a) - keyOf(b) : keyOf(b) - keyOf(a));
}

/** 下载文本文件（导出用） */
export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 读取本地文件为文本 */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
