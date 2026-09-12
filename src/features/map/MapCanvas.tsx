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
import { useCallback, useMemo, useRef, useState } from 'react';
import type { MapDef, MapPin, MapRegion, MapTool } from '@/types';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { cn } from '@/lib/utils';
import { MapPinLayer } from './MapPinLayer';
import { MapRegionLayer } from './MapRegionLayer';
import { clampNorm } from './mapRender';

interface Props {
  map: MapDef;
  pins: MapPin[];
  regions: MapRegion[];
  tool: MapTool;
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
  map, pins, regions, tool, selectedPinId, selectedRegionId, regionMode, resourceKey,
  showLabels, onCanvasClick, onPinMove, onPinSelect, onRegionSelect, onRegionPointMove, className,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const background = useAssetUrl(map.asset_id);
  const [draggingPin, setDraggingPin] = useState<string | null>(null);

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

  return (
    <div
      ref={surfaceRef}
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg border border-border bg-grid',
        tool === 'pan' ? 'cursor-grab' : tool === 'pin' ? 'cursor-crosshair' : 'cursor-default',
        className,
      )}
      onPointerMove={(e) => {
        if (!draggingPin) return;
        const [x, y] = toNorm(e.clientX, e.clientY);
        onPinMove(draggingPin, x, y);
      }}
      onPointerUp={() => setDraggingPin(null)}
      onPointerLeave={() => setDraggingPin(null)}
      onClick={(e) => {
        // 只有点在「空白画布」上才算：标记与区域内部会 stopPropagation
        if ((e.target as HTMLElement).dataset.surface !== 'true') return;
        if (tool === 'pin') {
          const [x, y] = toNorm(e.clientX, e.clientY);
          onCanvasClick(x, y);
        } else {
          onPinSelect(null);
          onRegionSelect(null);
        }
      }}
    >
      {/* 底图 */}
      {background ? (
        <img
          src={background}
          alt={map.name}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
          style={{ opacity: map.opacity }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded bg-background/75 px-2 py-1 text-[11px] text-muted-foreground">
            未设置底图 —— 可直接摆放标记点，之后在左侧上传底图不会错位
          </span>
        </div>
      )}

      <MapRegionLayer
        regions={regions}
        selectedRegionId={selectedRegionId}
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
        showLabels={showLabels}
        onSelect={onPinSelect}
        onDragStart={setDraggingPin}
      />
    </div>
  );
}
