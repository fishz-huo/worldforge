/**
 * 地图画布
 * ------------------------------------------------------------------
 * 需求 2：可视化地图编辑器。
 * 设计取舍：不做精细的边界绘制（那会变成 GIS 工具），
 * 而是「底图 + 归一化标记点 + 粗略多边形区域」，
 * 让作者能快速表达「谁在哪、资源怎么分布、疆域怎么变」。
 *
 * 坐标系统：0~1 归一化，渲染时乘以画布尺寸，
 * 因此底图换分辨率、窗口缩放都不会错位。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapDef, MapPin, MapRegion, MapTool } from '@/types';
import { cn } from '@/lib/utils';
import { MapBackground } from './MapBackground';
import { MapPinLayer } from './MapPinLayer';
import { MapRegionLayer } from './MapRegionLayer';
import { clampNorm } from './mapRender';
import type { MapViewMode } from './mapRender';

interface Props {
  map: MapDef;
  pins: MapPin[];
  regions: MapRegion[];
  tool: MapTool;
  /** 编辑 / 预览：预览下不落点、不写坐标 */
  viewMode: MapViewMode;
  selectedPinId: string | null;
  selectedRegionId: string | null;
  /** 区域显示模式：填充 / 仅轮廓 / 资源热度 */
  regionMode: 'fill' | 'outline' | 'resource';
  resourceKey: keyof NonNullable<MapRegion['resources']>;
  showLabels: boolean;
  onCanvasClick: (x: number, y: number) => void;
  onPinMove: (pinId: string, x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onRegionSelect: (regionId: string | null) => void;
  onRegionPointMove: (regionId: string, index: number, x: number, y: number) => void;
  className?: string;
}

export function MapCanvas({
  map, pins, regions, tool, viewMode, selectedPinId, selectedRegionId, regionMode, resourceKey,
  showLabels, onCanvasClick, onPinMove, onPinSelect, onRegionSelect, onRegionPointMove, className,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [draggingPin, setDraggingPin] = useState<string | null>(null);
  const hasBackground = Boolean(map.asset_id);

  /** 换算：鼠标事件 → 归一化坐标 */
  const toNorm = useCallback((clientX: number, clientY: number): [number, number] => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return [0.5, 0.5];
    return [
      clampNorm((clientX - rect.left) / rect.width),
      clampNorm((clientY - rect.top) / rect.height),
    ];
  }, []);

  /** 资源热度模式的归一化基准 */
  const maxResource = useMemo(
    () => Math.max(1, ...regions.map((r) => Number(r.resources?.[resourceKey] ?? 0))),
    [regions, resourceKey],
  );

  /**
   * 切到预览时清掉「正在被拖动」的标记。
   * 否则拖到一半切模式，松手前那几次 pointermove 还在往库里写坐标。
   */
  useEffect(() => {
    if (viewMode === 'preview') setDraggingPin(null);
  }, [viewMode]);

  /** 光标：预览模式不需要「可以画」的提示，编辑模式按当前工具给 */
  const cursorClass =
    viewMode === 'preview'
      ? 'cursor-default'
      : tool === 'pan'
        ? 'cursor-grab'
        : tool === 'pin'
          ? 'cursor-crosshair'
          : 'cursor-default';

  return (
    <div
      ref={surfaceRef}
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg border border-border bg-grid',
        cursorClass,
        className,
      )}
      onPointerMove={(e) => {
        // 预览模式不写坐标（拖拽本就不该开始，这里再兜一层）
        if (viewMode !== 'edit' || !draggingPin) return;
        const [x, y] = toNorm(e.clientX, e.clientY);
        onPinMove(draggingPin, x, y);
      }}
      onPointerUp={() => setDraggingPin(null)}
      onPointerLeave={() => setDraggingPin(null)}
      onClick={(e) => {
        // 只有点在「空白画布」上才算：标记与区域内部会 stopPropagation
        if ((e.target as HTMLElement).dataset.surface !== 'true') return;
        // 预览模式只允许「点空白取消选中」，绝不落点（写入回调在这里就返回）
        if (viewMode === 'edit' && tool === 'pin') {
          const [x, y] = toNorm(e.clientX, e.clientY);
          onCanvasClick(x, y);
        } else {
          onPinSelect(null);
          onRegionSelect(null);
        }
      }}
    >
      {/* 底图 */}
      <MapBackground map={map} />

      {!hasBackground && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded bg-background/75 px-2 py-1 text-[11px] text-muted-foreground">
            未设置底图 —— 可直接摆放标记点，之后补图不会错位
          </span>
        </div>
      )}

      <MapRegionLayer
        regions={regions}
        selectedRegionId={selectedRegionId}
        viewMode={viewMode}
        mode={regionMode}
        metric={String(resourceKey)}
        maxValue={maxResource}
        showLabels={showLabels}
        onSelect={onRegionSelect}
        onPointMove={onRegionPointMove}
        toNorm={toNorm}
      />

      <MapPinLayer
        pins={pins}
        selectedPinId={selectedPinId}
        viewMode={viewMode}
        showLabels={showLabels}
        onSelect={onPinSelect}
        onDragStart={setDraggingPin}
      />
    </div>
  );
}
