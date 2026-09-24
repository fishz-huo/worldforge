/**
 * 把窗口收进屏幕（桌面版启动时跑一次）
 * ==================================================================
 * 为什么需要这件事：tauri.conf.json 里的窗口尺寸是**逻辑像素**，而 1080p
 * 显示器上 Windows 最常见的缩放是 125% / 150% —— 缩放后系统的可用区域只有
 * 约 1536×816 / 1280×672 逻辑像素。配置里写的 1360×880 会高出屏幕一截，
 * 窗口底部的按钮永远露不出来（用户反馈的"有些功能按钮点不到"就是这么来的）。
 *
 * 做法：读当前显示器的工作区（系统已经扣掉任务栏），窗口比它大就收进去并居中；
 * 够大就一个字都不动 —— 只缩小、绝不放大，也不改用户已经调过的尺寸。
 *
 * 只在 Tauri 壳里生效：浏览器里 window.outerWidth 是标签页的尺寸，也没有
 * 「窗口」这个概念可调，所以那边直接返回 false。
 */
import { isDesktop } from './save-open';

/** 边缘留白：窗口正好贴死屏幕边时，边框与右上角的最大化按钮都不好点 */
const MARGIN = 16;

/**
 * 纯计算部分：窗口现尺寸与屏幕工作区尺寸**都换算成逻辑像素**后传进来，
 * 返回该设成多少；够放就返回 null（什么都不用做）。
 * 单独抽出来是为了能脱开 Tauri 环境做自测（见 scripts/layout-selftest.mjs）。
 */
export function computeWindowFit(
  nowW: number,
  nowH: number,
  areaW: number,
  areaH: number,
): { width: number; height: number } | null {
  const maxW = areaW - MARGIN;
  const maxH = areaH - MARGIN;
  if (nowW <= maxW && nowH <= maxH) return null;
  // 只缩不放；并且保证算出来的尺寸是正数（工作区小于留白时也不会算出 0 或负数）
  return {
    width: Math.max(1, Math.round(Math.min(nowW, maxW))),
    height: Math.max(1, Math.round(Math.min(nowH, maxH))),
  };
}

/**
 * 窗口比屏幕工作区大时收进屏幕；返回是否真的调过尺寸（便于调试与自测）。
 * 任何一步失败都只是"没调成"，不能影响界面启动，所以整段包在 try 里。
 */
export async function fitWindowToScreen(): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    const { getCurrentWindow, currentMonitor, LogicalSize } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    const monitor = await currentMonitor();
    if (!monitor) return false;

    const outer = await win.outerSize();
    // 工作区给的是物理像素，除以缩放系数才是窗口尺寸用的逻辑像素
    const factor = monitor.scaleFactor || 1;
    const area = monitor.workArea?.size ?? monitor.size;
    const next = computeWindowFit(outer.width / factor, outer.height / factor, area.width / factor, area.height / factor);
    if (!next) return false;

    await win.setSize(new LogicalSize(next.width, next.height));
    await win.center();
    console.info(`[worldforge] 窗口已收进屏幕：${Math.round(outer.width / factor)}×${Math.round(outer.height / factor)} → ${next.width}×${next.height}`);
    return true;
  } catch (err) {
    // 收不进屏幕不致命：界面按配置尺寸照常显示，只是可能要点一下最大化
    console.warn('[worldforge] 窗口自适应失败', err);
    return false;
  }
}
