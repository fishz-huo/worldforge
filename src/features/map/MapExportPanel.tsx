/**
 * 工具条上的「导出图片」入口（按钮 + 选项弹层）
 * ==================================================================
 * 位置在工具条右侧、模式开关左边（用户拍板）：**编辑与预览都能用** ——
 * 预览是最常导出的场景，放左栏就导不了（预览时左栏只剩地图列表）。
 * 面板里三组选项 + 一行实时尺寸 + 一行状态；导出是异步的，期间按钮转圈并禁用。
 * 选项口径见 useMapExport 与 mapExportRect（默认 当前视口 / PNG / 2×）。
 */
import type { ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ExportFormat, ExportScope, ExportScale } from './mapExportRect';
import { useMapExport } from './useMapExport';
import type { MapExportArgs } from './useMapExport';

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'png', label: 'PNG（默认）' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'svg', label: 'SVG（矢量）' },
];

const SCOPES: { value: ExportScope; label: string }[] = [
  { value: 'viewport', label: '当前视口' },
  { value: 'full', label: '整张底图' },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function MapExportPanel(args: MapExportArgs) {
  const ex = useMapExport(args);
  const sizeText = ex.plan
    ? `将导出 ${ex.plan.size.w} × ${ex.plan.size.h} 像素${ex.plan.fit.downgraded ? `（${ex.scale}× 超出上限，按 ${ex.plan.fit.scale}×）` : ''}`
    : '量不到画布尺寸：先切到地图页，再打开这个面板';

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/*
          纯图标 + title：实测带文字的按钮（84px）会把工具条在 1440 宽就挤成两行，
          而工具条的 36px 高度是与左右面板标题行对齐的（用户 2026-09-24 定的）。
          图标按钮占 32px，实测 1440 恢复单行；文案在弹层里，不丢信息。
        */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="把当前地图导出成一张图片"
          aria-label="导出图片"
        >
          <Download className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <Row label="格式">
          <Select value={ex.format} onValueChange={(v) => ex.setFormat(v as ExportFormat)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="范围">
          <Select value={ex.scope} onValueChange={(v) => ex.setScope(v as ExportScope)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="倍数">
          <Select value={String(ex.scale)} onValueChange={(v) => ex.setScale(Number(v) as ExportScale)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ex.scales.map((k) => (
                <SelectItem key={k} value={String(k)} className="text-xs">{k}×</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <p className="text-[10px] leading-relaxed text-muted-foreground">{sizeText}</p>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          导出的是你看到的样子：不含网格、选中虚线框与控制点。倍数按底图的原始像素算
          （整张底图 1× 就是底图原始像素），所以 3× 只是把图放大，糊的底图不会因此变清晰。
        </p>

        <Button className="h-8 w-full gap-1" disabled={ex.busy || !ex.plan} onClick={() => void ex.run()}>
          {ex.busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {ex.busy ? '正在导出…' : '导出'}
        </Button>

        {ex.status.text && (
          <p
            className={cn(
              'text-[10px] leading-relaxed',
              ex.status.kind === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {ex.status.text}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
