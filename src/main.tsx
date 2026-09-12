/**
 * 应用入口
 * ------------------------------------------------------------------
 * 1. 挂载 React；
 * 2. 暴露 WorldForge 全局对象（插件以 Blob 模块载入，无法 import 裸模块名，
 *    需要 React 时用 api.ui.React，这里同时提供全局兜底）；
 * 3. 注册 Service Worker 让 PWA 可离线安装；
 * 4. 启动 store（初始化 sql.js → 装载数据 → 激活插件）。
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { startApp, useStore } from './store';
import './index.css';

/** 插件可用的全局运行时（api.ui.React 是推荐用法，这里是兜底） */
declare global {
  interface Window {
    WorldForge?: { React: typeof React; version: string };
  }
}
window.WorldForge = { React, version: '0.1.0' };

/** 注册 Service Worker（仅生产构建；开发时避免缓存干扰热更新） */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[worldforge] Service Worker 注册失败', err);
    });
  });
}

/** 启动：先把界面渲染出来（loading 态），再异步初始化数据库 */
async function main() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  registerServiceWorker();
  await startApp();
}

// 顶层错误兜底：把致命错误写进 store，界面会展示错误页而不是白屏
window.addEventListener('error', (e) => {
  console.error('[worldforge] 未捕获错误', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[worldforge] 未处理的 Promise 拒绝', e.reason);
  try {
    useStore.getState().toast(`操作失败：${String(e.reason?.message ?? e.reason)}`, 'error');
  } catch {
    /* store 可能还没就绪 */
  }
});

void main();
