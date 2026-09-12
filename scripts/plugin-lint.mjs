/**
 * 插件源码检查器
 * ------------------------------------------------------------------
 * 插件的四条硬约束，违反了都不会在 typecheck / 构建期报错，只是静默失效：
 *   1. 只能调用 PluginAPI 里真实存在的成员（指南里曾大面积出现幽灵接口）；
 *   2. 不能 import —— 它以 Blob 模块载入，裸模块名解析不了，跑到那行才炸；
 *   3. document / window 上的监听必须有配套的 removeEventListener，
 *      否则停用插件后界面上留残余（FAQ 里最常见的一条）；
 *   4. manifest 里声明的设置项必须被真正读过，不然设置表单上的开关是个摆设。
 * 另外帮宿主守住 DOM 契约：插件依赖的 data-wf-* 标记必须在源码里真实存在。
 *
 * 只做文本分析，不执行插件代码，因此能被 scripts/plugin-selftest.mjs 直接调用。
 */

/** 插件用到的 PluginAPI 成员（源码里所有 `api.xxx`） */
export function usedApiMembers(source) {
  return [...new Set([...source.matchAll(/\bapi\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))];
}

/** 用了但 PluginAPI 里没有的成员（幽灵接口） */
export function ghostApiMembers(source, members) {
  return usedApiMembers(source).filter((name) => !members.has(name));
}

/** 顶格的 import 语句（插件只能是单文件、无外部依赖） */
export function importStatements(source) {
  return [...source.matchAll(/^[ \t]*import\b[^\n]*/gm)].map((m) => m[0].trim());
}

/** document / window（含其别名）上的监听，是否有配套的 removeEventListener */
export function uncleanListeners(source) {
  const globals = new Set(['document', 'window', 'globalThis']);
  // 别名只认「整个赋值就是全局对象」的写法；`const view = document.createElement(...)` 不算
  for (const m of source.matchAll(/const\s+(\w+)\s*=\s*(document|window)\s*[;\n]/g)) globals.add(m[1]);
  const collect = (method) => {
    const types = new Set();
    const pattern = new RegExp(`\\b(\\w+)\\.${method}\\(\\s*['"]([\\w:]+)['"]`, 'g');
    for (const m of source.matchAll(pattern)) if (globals.has(m[1])) types.add(m[2]);
    return types;
  };
  const removed = collect('removeEventListener');
  return [...collect('addEventListener')].filter((type) => !removed.has(type));
}

/** 插件在 manifest 里声明、却从未读取的设置键（死设置） */
export function unusedSettings(source) {
  const block = source.match(/export const manifest\s*=\s*\{[\s\S]*?\n\};/)?.[0] ?? '';
  const keys = [...block.matchAll(/^\s{4}(\w+):\s*\{/gm)].map((m) => m[1]);
  const body = source.replace(block, '');
  // 「读过」的两种写法：opt('key') 这类取值，或 api.settings.key 这类属性访问
  return keys.filter((key) => !new RegExp(`['"\`]${key}['"\`]|\\.${key}\\b`).test(body));
}

/** 插件依赖的宿主 DOM 契约属性（data-wf-*） */
export function requiredContracts(source) {
  return [...new Set([...source.matchAll(/data-wf-[a-z][a-z-]*/g)].map((m) => m[0]))];
}

/** 插件是否具备基本形状：导出 activate 与 manifest，且返回清理函数 */
export function pluginShapeProblems(source, fileName = 'plugin.js') {
  const problems = [];
  if (!/export\s+function\s+activate\s*\(/.test(source)) problems.push(`${fileName} 缺少 activate 导出`);
  if (!/export const manifest\s*=/.test(source)) problems.push(`${fileName} 缺少 manifest（设置 schema 靠它声明）`);
  if (!/return\s*\(\s*\)\s*=>/.test(source)) problems.push(`${fileName} 的 activate 没有返回清理函数`);
  return problems;
}
