/**
 * 图片资源服务
 * ------------------------------------------------------------------
 * 需求 5：插入角色形象、背景设定图。
 * 策略：元数据入 SQLite（assets 表），二进制入 IndexedDB（assets 仓库），
 *       渲染时用 objectURL，并做引用计数缓存避免重复解码与内存泄漏。
 */
import type { Asset } from '@/types';
import { newAssetId } from '@/lib/id';
import { assetsRepo } from './db/tables';
import { deleteAssetBlob, getAssetBlob, putAssetBlob } from './db/idb';

/** objectURL 缓存：assetId → { url, refs } */
const urlCache = new Map<string, { url: string; refs: number }>();

/** 读取图片真实尺寸（优先 createImageBitmap，性能更好） */
async function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    }
  } catch {
    /* 退回到 <img> 方案 */
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** 导入一张本地图片：写 IndexedDB + 写元数据表，返回 Asset 记录 */
export async function importImage(file: File, worldId: string): Promise<Asset> {
  const id = newAssetId();
  const { width, height } = await readImageSize(file);
  await putAssetBlob(id, file);
  const asset: Asset = {
    id,
    world_id: worldId,
    name: file.name || '未命名图片',
    mime: file.type || 'image/png',
    size: file.size,
    width,
    height,
    kind: 'image',
    created_at: Date.now(),
  };
  assetsRepo.save(asset);
  return asset;
}

/** 从剪贴板 / base64 导入（Markdown 里粘贴图片时用） */
export async function importImageBlob(blob: Blob, worldId: string, name = '粘贴的图片.png'): Promise<Asset> {
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  return importImage(file, worldId);
}

/** 取得可渲染的 objectURL（带引用计数） */
export async function acquireAssetUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) {
    cached.refs += 1;
    return cached.url;
  }
  const blob = await getAssetBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, { url, refs: 1 });
  return url;
}

/** 释放一次引用；归零时回收 objectURL */
export function releaseAssetUrl(id: string): void {
  const cached = urlCache.get(id);
  if (!cached) return;
  cached.refs -= 1;
  if (cached.refs <= 0) {
    URL.revokeObjectURL(cached.url);
    urlCache.delete(id);
  }
}

/** 强制回收某资源的 URL（删除图片时用） */
export function revokeAssetUrl(id: string): void {
  const cached = urlCache.get(id);
  if (!cached) return;
  URL.revokeObjectURL(cached.url);
  urlCache.delete(id);
}

/** 删除资源：同时清理元数据与二进制 */
export async function removeAsset(id: string): Promise<void> {
  revokeAssetUrl(id);
  assetsRepo.remove(id);
  await deleteAssetBlob(id);
}

/** 统计某世界观已用图片的体积 */
export function assetUsage(worldId: string): { count: number; bytes: number } {
  const list = assetsRepo.list('world_id = ?', [worldId]);
  return {
    count: list.length,
    bytes: list.reduce((sum, a) => sum + (a.size || 0), 0),
  };
}

/** 把图片缩放为 dataURL（用于导出、缩略图） */
export async function assetToDataUrl(id: string, maxSize = 512): Promise<string | null> {
  const blob = await getAssetBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = url;
    });
    if (!img) return null;
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1) {
      return await blobToDataUrl(blob);
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Blob → dataURL */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** dataURL → Blob（导入备份时还原图片） */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
