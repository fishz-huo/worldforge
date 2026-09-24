/**
 * 地图导出的运行流程（选项 → 实时尺寸 → 导出 → 状态文案）
 * ==================================================================
 * 数据流：选项 → 导出矩形（mapExportRect）→ 倍数夹取 → 取底图 data: URL
 * → 取图标（mapGlyphSvg）→ 拼 SVG（mapExportSvg）→ 光栅化（mapExportImage）
 * → saveFile（lib/save-open：桌面弹系统「另存为」、网页走浏览器下载）。
 *
 * 所有"顺手少做了一点"的地方都写进状态文案：倍数被降级、底图读不到、
 * 几个图标没取到 —— 静默降级比报错更难查。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MapPin, MapRegion } from '@/types';
import { isMobileShell, saveFile } from '@/lib/save-open';
import type { SaveFilter } from '@/lib/save-open';
import { canvasBoxSize, collectGlyphs } from './mapGlyphSvg';
import { assetDataUrl, blobToBytes, svgToBlob } from './mapExportImage';
import {
  EXPORT_SCALES, exportFileName, exportRect, fitScale, formatMime, outputSize, screenScale,
} from './mapExportRect';
import type { ExportBox, ExportFormat, ExportScale, ExportScope, RegionMode } from './mapExportRect';
import { buildExportSvg } from './mapExportSvg';
import type { Size } from './mapViewport';
import type { MapViewportApi } from './mapViewportApi';

/** 「另存为」对话框的类型过滤：不写过滤器时 Windows 可能把文件名补成 .json */
const FILTERS: Record<ExportFormat, SaveFilter[]> = {
  png: [{ name: 'PNG 图片', extensions: ['png'] }],
  jpeg: [{ name: 'JPG 图片', extensions: ['jpg', 'jpeg'] }],
  svg: [{ name: 'SVG 矢量图', extensions: ['svg'] }],
};

export interface MapExportArgs {
  mapName: string;
  world: Size;
  assetId: string | null;
  opacity: number;
  viewport: MapViewportApi;
  pins: MapPin[];
  regions: MapRegion[];
  terrain: MapPin[];
  regionMode: RegionMode;
  resourceKey: keyof NonNullable<MapRegion['resources']>;
  showLabels: boolean;
}

export type ExportStatusKind = 'idle' | 'busy' | 'ok' | 'warn' | 'error';
export interface ExportStatus { kind: ExportStatusKind; text: string }

const notesOf = (notes: string[]) => (notes.length ? `（${notes.join('；')}）` : '');

export function useMapExport(args: MapExportArgs) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scope, setScope] = useState<ExportScope>('viewport');
  const [scale, setScale] = useState<ExportScale>(2);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle', text: '' });
  /** 画布可见区的像素尺寸：面板里那行「将导出 W×H」要它，窗口缩放时跟着更新 */
  const [box, setBox] = useState<ExportBox | null>(null);

  useEffect(() => {
    const sync = () => setBox(canvasBoxSize());
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  /** 资源热度模式的归一化基准（与 MapCanvas 同款算法，非数字按 0 算） */
  const maxResource = useMemo(() => {
    const values = args.regions.map((r) => {
      const v = Number(r.resources?.[args.resourceKey] ?? 0);
      return Number.isFinite(v) ? v : 0;
    });
    return Math.max(1, ...values);
  }, [args.regions, args.resourceKey]);

  /** 实时尺寸：拿不到画布尺寸时给 null，面板如实显示，不猜 */
  const plan = useMemo(() => {
    if (!box) return null;
    const rect = exportRect(scope, args.world, box, args.viewport.toScreenPixel);
    const fit = fitScale(rect, scale, format, isMobileShell());
    return { rect, fit, size: outputSize(rect, fit.scale) };
  }, [box, scope, scale, format, args.world, args.viewport.toScreenPixel]);

  const run = useCallback(async () => {
    const canvas = canvasBoxSize();
    if (!canvas) {
      setStatus({ kind: 'error', text: '导出失败：量不到画布尺寸，请切到地图页再试' });
      return;
    }
    setBusy(true);
    setStatus({ kind: 'busy', text: '正在导出…' });
    const notes: string[] = [];
    try {
      const rect = exportRect(scope, args.world, canvas, args.viewport.toScreenPixel);
      const fit = fitScale(rect, scale, format, isMobileShell());
      if (fit.downgraded) {
        notes.push(`${scale}× 会到 ${Math.round(rect.w * scale)}×${Math.round(rect.h * scale)}，`
          + `超出浏览器上限，已按 ${fit.scale}× 导出`);
      }
      const size = outputSize(rect, fit.scale);
      const href = await assetDataUrl(args.assetId);
      if (args.assetId && !href) notes.push('底图读不到，已导出其余图层');
      const pinGlyphs = collectGlyphs('data-wf-map-pin', args.pins.map((p) => p.id));
      const terrainGlyphs = collectGlyphs('data-wf-map-terrain', args.terrain.map((p) => p.id));
      const missing = pinGlyphs.missing.length + terrainGlyphs.missing.length;
      if (missing > 0) notes.push(`${missing} 个图标没从界面取到，已跳过`);
      const svg = buildExportSvg({
        rect,
        world: args.world,
        s: screenScale(args.world, args.viewport.toScreenPixel),
        k: fit.scale,
        backdrop: href ? { href, opacity: args.opacity } : null,
        regions: args.regions,
        regionMode: args.regionMode,
        metric: args.resourceKey,
        maxValue: maxResource,
        showLabels: args.showLabels,
        terrain: args.terrain,
        pins: args.pins,
        pinGlyphs: pinGlyphs.hits,
        terrainGlyphs: terrainGlyphs.hits,
      });
      const name = exportFileName(args.mapName, scope, fit.scale, format);
      const outcome = format === 'svg'
        ? await saveFile(name, svg, 'image/svg+xml', FILTERS.svg)
        : await saveFile(
          name,
          await blobToBytes(await svgToBlob(svg, size, format)),
          formatMime(format),
          FILTERS[format],
        );
      if (outcome.canceled) {
        setStatus({ kind: 'idle', text: '已取消' });
        return;
      }
      if (!outcome.ok) {
        setStatus({ kind: 'error', text: `导出失败：${outcome.error ?? '未知原因'}${notesOf(notes)}` });
        return;
      }
      const where = outcome.path
        ? `已保存到 ${outcome.path}`
        : '已交给浏览器下载（在下载目录里找）';
      setStatus({ kind: notes.length ? 'warn' : 'ok', text: `${where}（${size.w}×${size.h}）${notesOf(notes)}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', text: `导出失败：${msg}${notesOf(notes)}` });
    } finally {
      setBusy(false);
    }
  }, [args, format, scope, scale, maxResource]);

  return {
    format, setFormat, scope, setScope, scale, setScale,
    scales: EXPORT_SCALES, plan, busy, status, run,
  };
}
