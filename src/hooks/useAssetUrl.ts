/**
 * 资源 URL Hook
 * ------------------------------------------------------------------
 * 图片二进制存在 IndexedDB，渲染前先取回 Blob 并生成 objectURL。
 * 这里做了引用计数（见 lib/assets.ts），组件卸载时释放，
 * 避免反复切换卡片时把内存耗光。
 */
import { useEffect, useState } from 'react';
import { acquireAssetUrl, releaseAssetUrl } from '@/lib/assets';

/** 取得某资源的可渲染 URL；资源不存在时返回 null */
export function useAssetUrl(assetId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      return;
    }
    let alive = true;
    void acquireAssetUrl(assetId).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
      releaseAssetUrl(assetId);
    };
  }, [assetId]);

  return url;
}

/**
 * 批量解析资源 URL（Markdown 正文里可能内嵌多张图片）。
 * 返回 assetId → objectURL 的映射；组件卸载时统一释放。
 */
export function useAssetUrlMap(ids: string[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  // 依赖数组需要稳定：把 id 列表拼成字符串作为 key
  const key = ids.join(',');

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setMap({});
      return;
    }
    let alive = true;
    void Promise.all(list.map(async (id) => [id, await acquireAssetUrl(id)] as const)).then((pairs) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      pairs.forEach(([id, url]) => {
        if (url) next[id] = url;
      });
      setMap(next);
    });
    return () => {
      alive = false;
      list.forEach((id) => releaseAssetUrl(id));
    };
  }, [key]);

  return map;
}
