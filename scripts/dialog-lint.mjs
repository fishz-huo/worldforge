/**
 * 源码检查：不得直接调用浏览器的原生对话框
 * ------------------------------------------------------------------
 * 桌面版（Tauri）会把 `window.confirm / alert / prompt` 转发给 dialog 插件，
 * 而 capabilities 只放开了 `dialog:default`（保存/打开文件），
 * 于是 `window.confirm` 会抛「dialog.confirm not allowed. Command not found」——
 * 所有删除、清空、重建操作在桌面版里全部失效（真实缺陷，已修）。
 *
 * 现在统一走 lib/confirm.ts 的 `askConfirm`（应用内对话框）：
 * 两种环境行为一致、能保留多行排版、样式与应用统一。
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

/**
 * 匹配原生对话框调用：`confirm(` / `window.confirm(` / `!alert(` / `globalThis.prompt(`…
 * 不匹配 `askConfirm(`、`onConfirm(`、`confirmText`，
 * 也不匹配 `dialog.confirm(`（Tauri 插件自己的 API，写法带命名空间）。
 */
const NATIVE_DIALOG_RE = /(?:(?<![.\w])|(?<=window\.)|(?<=globalThis\.))(confirm|alert|prompt)\s*\(/g;

/** 扫描一段源码，返回命中位置（行号 + 名称） */
export function lintNativeDialogs(src, file = '') {
  const hits = [];
  for (const match of src.matchAll(NATIVE_DIALOG_RE)) {
    // window.confirm 已经算命中；这里只排除其它命名空间调用（如 dialog.confirm）
    const prefix = src.slice(Math.max(0, match.index - 12), match.index);
    if (/[.\w]/.test(src[match.index - 1] ?? '') && !/window\.$|globalThis\.$/.test(prefix)) continue;
    hits.push({
      file,
      line: src.slice(0, match.index).split('\n').length,
      name: `${match[1]}(`,
    });
  }
  return hits;
}

/** 扫描一批文件，返回全部命中 */
export function scanNativeDialogs(files, root) {
  const out = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const hit of lintNativeDialogs(src, relative(root, file))) {
      out.push(`${hit.file}:${hit.line} → ${hit.name}`);
    }
  }
  return out;
}

/** 可证伪样本：裸 confirm 与 window.confirm 要能检出，askConfirm 不能误伤 */
export const DIALOG_FIXTURES = {
  bad: `if (confirm('删掉？')) doIt();`,
  alsoBad: `if (window.confirm('删掉？')) doIt();`,
  alertBad: `if (!alert('注意')) return;`,
  ok: `if (await askConfirm('删掉？')) doIt();`,
  alsoOk: `onConfirm={() => askConfirm('再问一次')}`,
};
