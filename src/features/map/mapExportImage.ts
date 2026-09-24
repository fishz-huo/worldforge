/**
 * 地图导出：取图与光栅化（只在浏览器里跑）
 * ==================================================================
 * 一条路：SVG 字符串 → Blob URL → `<img>` → Canvas（先铺底色）→ `toBlob`。
 * 三个必须记住的点：
 *   1. 底图必须**内联成 data: URL**：SVG 当图片渲染时外部资源（blob:/http:）
 *      不会被加载，用 objectURL 只会得到一张没有底图的图，而且不报错；
 *   2. 中文字符串要带 charset（`image/svg+xml;charset=utf-8`），否则标签可能乱码；
 *   3. `toBlob` 在超大画布上会返回 null（内存不足）：必须报错，不能静默失败。
 */
import { blobToDataUrl } from '@/lib/assets';
import { getAssetBlob } from '@/lib/db/idb';
import { EXPORT_BG } from './mapExportRect';

/** 资源 → data: URL。取**原图不缩**：`assets.assetToDataUrl` 默认缩到 512，不能用于导出 */
export async function assetDataUrl(assetId: string | null): Promise<string | null> {
  if (!assetId) return null;
  const blob = await getAssetBlob(assetId);
  if (!blob) return null;
  return blobToDataUrl(blob);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片渲染失败（SVG 里可能有非法字符）'));
    img.src = url;
  });
}

/**
 * SVG 字符串 → 图片 Blob。
 * PNG 与 JPG 都先铺画布底色：JPG 没有透明通道（不铺会变黑），
 * PNG 也铺是为了「导出的就是看到的」，不做透明背景（本轮不做清单第 3 条）。
 */
export async function svgToBlob(
  svg: string,
  box: { w: number; h: number },
  format: 'png' | 'jpeg',
): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = box.w;
    canvas.height = box.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器没有给出 2D 画布');
    ctx.fillStyle = EXPORT_BG;
    ctx.fillRect(0, 0, box.w, box.h);
    ctx.drawImage(img, 0, 0, box.w, box.h);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
    });
    if (!blob) throw new Error(`画布太大（${box.w}×${box.h}），浏览器内存不足`);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Blob → 字节数组：交给 saveFile 走字节传输，避免大文件先变成字符串 */
export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
