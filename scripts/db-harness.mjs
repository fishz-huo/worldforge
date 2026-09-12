/**
 * 数据层自测的公共装配
 * ------------------------------------------------------------------
 * 在导入任何业务模块之前必须先装好三样东西：
 *   1. 内存版 IndexedDB（真实 IndexedDB 在 Node 里不存在）；
 *   2. 最小 DOM / localStorage 桩；
 *   3. 模块解析钩子（路径别名 @/、省略扩展名、Vite 的 ?url 资源导入）。
 * 顺序不能颠倒，因此这些动作都放在本模块的顶层执行，
 * 测试文件只要 `await import('./db-harness.mjs')` 即可。
 */
import { register } from 'node:module';
import { installBrowserStubs, installFakeIndexedDB } from './fake-idb.mjs';

const { databases } = installFakeIndexedDB();
installBrowserStubs();
register('./alias-hook.mjs', import.meta.url);

/** 数据库层（真实 sql.js + 假 IndexedDB） */
export const db = await import('@/lib/db/index.ts');
/** 全局 store */
export const { useStore } = await import('@/store/index.ts');
/** 便捷读取当前状态 */
export const state = () => useStore.getState();
/** IndexedDB 内存实例，用于断言快照是否真的落盘 */
export const idbDatabases = databases;
/** 读取当前数据库快照字节 */
export const snapshotBytes = () => idbDatabases.get('worldforge')?.stores.get('kv')?.get('worldforge.sqlite');

/** 启动应用（初始化数据库 → 首次播种 → 装载内存态） */
export async function boot() {
  await state().bootstrap();
}
