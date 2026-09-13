/**
 * 自测（十六）：移动端能力边界
 * ------------------------------------------------------------------
 * 用法：node scripts/mobile-selftest.mjs
 *
 * 起因是一次真实的构建失败：`WebviewWindow::print()` 挂在 Tauri 的 `#[cfg(desktop)]`
 * impl 块里，桌面端编得好好的，一到 `tauri android build` 就报 E0599 —— 这种
 * 「只在另一个平台才暴露」的问题，桌面上的 typecheck / build / npm test 全都看不见。
 *
 * 这里守两件事：
 *   1. 平台判定：桌面壳 / 移动壳 / 手机浏览器 三种环境要分得清，
 *      移动端不能再假装自己具备桌面能力（选目录、直接写盘、系统打印）；
 *   2. 移动端不许假装成功：写文件这条路在手机上走不通时必须明确报错，
 *      不能静默什么都不做 ——「导出完成却没有文件」正是这个项目吃过亏的那类 bug。
 * 另附两条静态检查，守住 Rust 与前端两侧的「桌面 / 移动」分支不会被改回去。
 */
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, finish, group, test } from './test-runner.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
register('./alias-hook.mjs', import.meta.url);
const { isDesktop, isMobileShell } = await import('@/lib/save-open.ts');
const { writeFiles } = await import('@/lib/save-batch.ts');

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0 Safari/537.36';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/153.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

/** 造一个运行环境：Tauri 壳靠 window.__TAURI_INTERNALS__ 认，UA 用来分桌面/移动 */
function setEnv({ tauri, ua }) {
  Object.defineProperty(globalThis, 'window', {
    value: tauri ? { __TAURI_INTERNALS__: {} } : {}, configurable: true, writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: ua }, configurable: true, writable: true,
  });
}

group('平台判定');

await test('桌面壳：isDesktop 为真、isMobileShell 为假', () => {
  setEnv({ tauri: true, ua: DESKTOP_UA });
  assert.equal(isDesktop(), true);
  assert.equal(isMobileShell(), false);
});

await test('Android 壳与 iOS 壳都算移动端', () => {
  setEnv({ tauri: true, ua: ANDROID_UA });
  assert.equal(isMobileShell(), true, 'Android 壳应判为移动端');
  setEnv({ tauri: true, ua: IPHONE_UA });
  assert.equal(isMobileShell(), true, 'iOS 壳应判为移动端');
});

await test('手机浏览器不算「移动壳」：没有 Tauri 内部对象时两者都为假', () => {
  setEnv({ tauri: false, ua: ANDROID_UA });
  assert.equal(isDesktop(), false, '网页版不是桌面壳');
  assert.equal(isMobileShell(), false, '手机浏览器走的是网页版分支，不该被当成移动壳');
});

group('移动端不假装成功');

await test('移动端写文件：明确报错，且一个文件都不算写出', async () => {
  setEnv({ tauri: true, ua: ANDROID_UA });
  const report = await writeFiles([{ name: 'a.md', text: 'x' }], null);
  assert.equal(report.written.length, 0, '不该报告写出了文件');
  assert.ok(report.errors.length > 0, '必须给出明确的失败原因，不能静默');
  assert.match(report.errors[0], /移动端/, '错误信息要说清是移动端的限制');
  assert.match(report.errors[0], /完整备份/, '要给出可行的替代做法');
});

await test('空清单仍然直接返回（不因为移动端判断而抛错）', async () => {
  const report = await writeFiles([], null);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.written, []);
});

group('静态：两侧的桌面 / 移动分支');

await test('Rust：print_window 必须桌面与移动各一份实现，移动那份不得调用桌面独有的 .print()', () => {
  const lib = readFileSync(join(ROOT, 'src-tauri/src/lib.rs'), 'utf8');
  assert.match(lib, /#\[cfg\(desktop\)\][\s\S]{0,400}?fn print_window/, '缺少桌面版 print_window');
  assert.match(lib, /#\[cfg\(mobile\)\][\s\S]{0,400}?fn print_window/, '缺少移动版 print_window');
  const mobilePart = lib.slice(lib.indexOf('#[cfg(mobile)]'));
  assert.ok(!/\.print\(\)/.test(mobilePart), '移动端实现里出现了桌面独有的 .print()，Android 编译会失败');
});

await test('前端：打印的桌面分支必须同时排除移动端', () => {
  const src = readFileSync(join(ROOT, 'src/lib/print-doc.ts'), 'utf8');
  assert.match(src, /isDesktop\(\)\s*&&\s*!isMobileShell\(\)/, '桌面分支没有排除移动端，手机上会去调不存在的 Rust 命令');
});

finish('移动端能力边界');
