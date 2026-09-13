/**
 * 打印文档 —— PDF 的出口
 * ==================================================================
 * 为什么 PDF 不做「后台静默生成」：生成 PDF 需要中文字体与排版引擎，只有浏览器内核
 * 自己最靠得住（自带系统字体、断行、分页、避头尾）。所以这里把导出内容渲染好的 HTML
 * 挂到 `#wf-print-root`（样式见 index.css 的打印区），再调打印：
 *   - 桌面版：Rust 命令 print_window → Tauri 的 webview.print()（Windows 下即 window.print()，
 *     macOS / Linux 走各自的原生打印流程）；
 *   - 网页版：直接 window.print()。
 * 用户在打印对话框里选「另存为 PDF」并挑保存位置，需求里的「自由选择导出路径」就是这么满足的。
 *
 * 一个细节：#wf-print-root 在屏幕上永远 display:none，只有打印媒体里才出现；
 * 打印对话框可能还开着，所以不能一调完就把内容删掉（删早了会打印出空白页），
 * 这里用 afterprint 事件 + 兜底定时器来回收。
 */
import { isDesktop } from './save-open';

const ROOT_ID = 'wf-print-root';
/** 兜底回收时间：afterprint 没触发（某些平台不触发）也不会把节点永久留在页面上 */
const KEEP_MS = 120_000;

let token = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let prevTitle: string | null = null;

/** 拿到（必要时创建）打印容器 */
function ensureRoot(): HTMLElement {
  const existing = document.getElementById(ROOT_ID);
  if (existing) return existing;
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  document.body.append(root);
  return root;
}

/** 等两帧：让浏览器完成排版再打印，否则可能打印出半成品 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** 清掉打印容器并还原窗口标题 */
function cleanup(myToken: number): void {
  if (myToken !== token) return; // 又发起了新的打印，别拆掉新的内容
  document.getElementById(ROOT_ID)?.remove();
  if (prevTitle !== null) {
    document.title = prevTitle;
    prevTitle = null;
  }
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * 打印一份 HTML（用户随后在打印对话框里「另存为 PDF」）。
 * @param html  导出内容片段（来自 lib/export/render-html.ts）
 * @param title 建议的文件名（会作为窗口标题，Chromium 拿它当 PDF 默认文件名）
 */
export async function printDocument(html: string, title: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof document === 'undefined') return { ok: false, error: '当前环境不支持打印' };
  token += 1;
  const myToken = token;
  const root = ensureRoot();
  root.innerHTML = html;
  if (prevTitle === null) prevTitle = document.title;
  // 去掉扩展名：Chromium 的「另存为 PDF」会自己补 .pdf
  document.title = title.replace(/\.[a-z0-9]{1,5}$/i, '') || 'WorldForge 导出';

  await nextFrame();
  try {
    if (isDesktop()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('print_window');
      // 桌面端打印是异步的：对话框关掉后触发 afterprint，兜底定时器再保一层
      if (timer) clearTimeout(timer);
      window.addEventListener('afterprint', () => cleanup(myToken), { once: true });
      timer = setTimeout(() => cleanup(myToken), KEEP_MS);
    } else {
      window.print(); // 网页版会阻塞到对话框关闭
      cleanup(myToken);
    }
    return { ok: true };
  } catch (err) {
    cleanup(myToken);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 应用退出或插件停用时把残留内容清掉 */
export function clearPrintRoot(): void {
  token += 1;
  cleanup(token);
}
