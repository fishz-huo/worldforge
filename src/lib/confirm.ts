/**
 * 确认对话框（替代 window.confirm）
 * ------------------------------------------------------------------
 * 为什么不能用 window.confirm：
 *  - **桌面版（Tauri）**：WebView 里 `window.confirm` 被 Tauri 接管，
 *    转发给 dialog 插件的 `confirm` 命令；只要 capabilities 没放开该命令，
 *    就会弹出「dialog.confirm not allowed. Command not found」，
 *    于是所有删除/清空操作在桌面版里全部失效（真实缺陷）。
 *  - **网页版**：原生 confirm 样式与应用脱节，也无法保留多行排版。
 *
 * 方案：应用内自己弹一个对话框，两种环境行为完全一致。
 * 用法：`if (await askConfirm('删除卡片「X」？')) { ... }`
 *
 * 实现：全局只挂一个 ConfirmHost（见 App.tsx），它把「弹出并等待选择」注册到这里；
 * 其余模块只调用 askConfirm，不需要 Context，也不必层层传 props。
 */

/** 一次确认请求的内容 */
export interface ConfirmRequest {
  message: string;
  /** 确认按钮文案，默认「确定」 */
  confirmText?: string;
  /** 危险操作：标题带警示图标、确认按钮用红色 */
  danger?: boolean;
}

type Handler = (request: ConfirmRequest) => Promise<boolean>;

let handler: Handler | null = null;

/** 由 ConfirmHost 在挂载时注册；返回取消注册函数 */
export function registerConfirmHost(next: Handler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

/**
 * 弹一个确认框，返回用户是否点了确认。
 * 宿主尚未挂载时返回 false —— 保守地「不执行」比误删安全，
 * 也绝不回退到 window.confirm（那正是桌面版报错的来源）。
 */
export function askConfirm(request: ConfirmRequest | string): Promise<boolean> {
  const normalized: ConfirmRequest = typeof request === 'string' ? { message: request } : request;
  if (!handler) {
    console.warn('[worldforge] 确认对话框尚未挂载，已按「取消」处理：', normalized.message);
    return Promise.resolve(false);
  }
  return handler(normalized);
}
