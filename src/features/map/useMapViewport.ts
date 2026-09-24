/**
 * 地图视口 Hook：把「滚轮缩放 + 拖拽平移 + 适应屏幕」接起来
 * ==================================================================
 * 数学全在 mapViewport.ts（纯函数、有自测），对外的类型在 mapViewportApi.ts。
 * 这里只负责三件事：
 *   1. 量出画布窗口尺寸（ResizeObserver），窗口变了就夹一次视口；
 *   2. 绑事件：滚轮缩放（锚点=光标）、指针拖拽平移（阈值 4px 区分拖与点）；
 *   3. 给出世界层的行内样式（宽高 = 底图原始像素 + translate/scale）。
 *
 * 两个容易踩的坑：滚轮必须用**原生** addEventListener + passive:false（React 把
 * wheel 委托到根节点，那里是被动监听，preventDefault 无效，时间轴那边踩过）；
 * 状态一律用函数式 setVp，事件回调里不去读渲染期的 vp，避免"慢一帧"。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import {
  clampViewport, fitScale, fitViewport, panBy, toScreen, wheelFactor, zoomAt, zoomPercent,
} from './mapViewport';
import type { MapViewport, Size } from './mapViewport';
import type { MapViewportApi } from './mapViewportApi';

/** 位移小于它算「点」、大于它算「拖」：免得平移完顺手把选中也取消了 */
const DRAG_THRESHOLD = 4;

/**
 * @param world 底图的世界尺寸（原始像素）
 * @param resetKey 换地图时归零（一般是 map.id）：换了图就重新「适应屏幕」
 * @param panEnabled 当前是否允许拖拽平移（预览模式 / 编辑模式的平移工具）
 * @param onInteract 用户开始缩放或平移时通知外部（用来收起悬浮浮窗）
 */
export function useMapViewport(
  world: Size,
  resetKey: string,
  panEnabled: boolean,
  onInteract?: () => void,
): MapViewportApi {
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Size>({ w: 0, h: 0 });
  const [vp, setVp] = useState<MapViewport>({ scale: 1, tx: 0, ty: 0 });
  /** 量到窗口尺寸之前先不显示世界层，免得第一帧露出"按原始像素摊开"的底图 */
  const ready = box.w > 0 && box.h > 0;
  const boxRef = useCallback((el: HTMLDivElement | null) => setBoxEl(el), []);
  /** 用户是否手动缩放/平移过：没动过就一直保持「适应屏幕」 */
  const touchedRef = useRef(false);
  const keyRef = useRef(resetKey);
  const vpRef = useRef(vp);
  const dragRef = useRef<{ x: number; y: number; vp: MapViewport } | null>(null);
  const draggedRef = useRef(false);
  const interactRef = useRef(onInteract);

  /** 让事件回调拿到最新视口（只在提交后赋值，不在渲染期写 ref） */
  useEffect(() => {
    vpRef.current = vp;
    interactRef.current = onInteract;
  });

  /** 量画布窗口尺寸：元素挂上时、以及之后每次改变都要 */
  useEffect(() => {
    if (!boxEl) return;
    const measure = () => setBox({ w: boxEl.clientWidth, h: boxEl.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(boxEl);
    return () => ro.disconnect();
  }, [boxEl]);

  /**
   * 窗口或底图尺寸变了：没手动动过就重新「适应屏幕」（换底图、刚打开走这条）；
   * 已经缩放/平移过只做边界修正，绝不把他正看的位置重置。
   * 换地图（resetKey 变了）等同于「没动过」。
   */
  useEffect(() => {
    if (box.w <= 0 || box.h <= 0) return;
    if (keyRef.current !== resetKey) {
      keyRef.current = resetKey;
      touchedRef.current = false;
    }
    setVp((v) => (touchedRef.current ? clampViewport(v, box, world) : fitViewport(box, world)));
    // 依赖用具体数字，避免尺寸对象每次新建引起的重复计算
  }, [box.w, box.h, world.w, world.h, resetKey]);

  const zoomAtAnchor = useCallback(
    (factor: number, anchorX?: number, anchorY?: number) => {
      touchedRef.current = true;
      interactRef.current?.();
      const ax = anchorX ?? box.w / 2;
      const ay = anchorY ?? box.h / 2;
      setVp((v) => zoomAt(v, factor, ax, ay, box, world));
    },
    [box, world],
  );

  const fit = useCallback(() => {
    touchedRef.current = false;
    setVp(fitViewport(box, world));
  }, [box, world]);

  /** 滚轮缩放：必须原生监听（React 的 wheel 是被动的，preventDefault 无效） */
  useEffect(() => {
    if (!boxEl) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = boxEl.getBoundingClientRect();
      touchedRef.current = true;
      interactRef.current?.();
      setVp((v) => zoomAt(v, wheelFactor(e.deltaY), e.clientX - rect.left, e.clientY - rect.top, box, world));
    };
    boxEl.addEventListener('wheel', onWheel, { passive: false });
    return () => boxEl.removeEventListener('wheel', onWheel);
  }, [boxEl, box.w, box.h, world.w, world.h]);

  const bind = useMemo(
    () => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (!panEnabled || e.button !== 0) return;
        draggedRef.current = false;
        dragRef.current = { x: e.clientX, y: e.clientY, vp: vpRef.current };
        // 捕获指针：拖到画布外面（甚至窗口边缘）也能继续收到移动
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const start = dragRef.current;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!draggedRef.current) {
          if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
          draggedRef.current = true;
          touchedRef.current = true;
          interactRef.current?.();
        }
        // 从「按下时那一帧的视口」算总位移：夹取不会被中途的边界修正吃掉
        setVp(panBy(start.vp, dx, dy, box, world));
      },
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
        dragRef.current = null;
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      },
      onPointerCancel: () => {
        dragRef.current = null;
      },
    }),
    [panEnabled, box, world],
  );

  const percent = useMemo(() => zoomPercent(vp, fitScale(box, world)), [vp, box, world]);
  const toScreenPixel = useCallback(
    (nx: number, ny: number) => toScreen(vp, nx, ny, world),
    [vp, world],
  );

  const worldStyle = useMemo(
    () =>
      ({
        position: 'absolute',
        left: 0,
        top: 0,
        width: world.w,
        height: world.h,
        // 量到窗口尺寸前先藏着：否则第一帧会露出"按原始像素摊开"的底图
        visibility: ready ? 'visible' : 'hidden',
        transformOrigin: '0 0',
        transform: `translate(${vp.tx}px, ${vp.ty}px) scale(${vp.scale})`,
        // 反向倍率：标记点/标签用它把自己缩放回去，保持屏幕尺寸恒定
        '--wf-map-inv-scale': String(vp.scale > 0 ? 1 / vp.scale : 1),
      }) as CSSProperties,
    [vp, world.w, world.h, ready],
  );

  return {
    boxRef,
    worldStyle,
    percent,
    bind,
    didDrag: () => draggedRef.current,
    notePress: () => {
      draggedRef.current = false;
    },
    zoomAtAnchor,
    fit,
    toScreenPixel,
  };
}
