/**
 * Node 解析钩子：补齐前端风格的模块说明符 + 提供最小浏览器桩
 * ------------------------------------------------------------------
 * 浏览器打包器（Vite）允许两种写法，Node 的 ESM 解析器默认都不认：
 *   1. 路径别名      `@/lib/utils`
 *   2. 省略扩展名    `./inline`
 * 另外还有 Vite 专有的资源导入：`?url`（sql.js 的 wasm）与 `?raw`（插件源码）。
 * 这个钩子把三者都补齐，让数据层与核心逻辑能直接在 Node 里跑自测。
 * 仅用于 scripts/*.mjs，不参与构建产物。
 */
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = process.cwd();
const require = createRequire(import.meta.url);
/** 依次尝试的扩展名与目录入口（空串放最后：仅当原路径本身就是文件时命中） */
const CANDIDATES = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', ''];

/** 在给定基路径上尝试补全，只接受真实文件 */
function tryFile(base) {
  // 先按原样尝试；若带了 .ts/.tsx 后缀但文件已变成目录（例如 seed.ts → seed/index.ts），
  // 再去掉后缀按目录入口找一次，避免重构后脚本报「找不到包」这种难懂的错。
  const bases = [base];
  const stripped = base.replace(/\.(ts|tsx|js|mjs)$/, '');
  if (stripped !== base) bases.push(stripped);
  for (const b of bases) {
    for (const suffix of CANDIDATES) {
      const candidate = b + suffix;
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        /* 不存在则继续 */
      }
    }
  }
  return null;
}

/** 把一段 JS 源码变成 data: 模块 URL */
function virtualModule(code) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
}

export function resolve(specifier, context, nextResolve) {
  // 1) Vite 的 `?raw` 源码导入 → 读成字符串常量，Node 里也能 import
  if (specifier.endsWith('?raw')) {
    const bare = specifier.slice(0, -4);
    const file = bare.startsWith('.')
      ? tryFile(join(dirname(fileURLToPath(context.parentURL)), bare))
      : null;
    if (file) {
      const code = `export default ${JSON.stringify(readFileSync(file, 'utf8'))};`;
      return { url: virtualModule(code), shortCircuit: true };
    }
  }
  // 2) Vite 的 `?url` 资源导入 → 解析成真实文件路径字符串
  if (specifier.endsWith('?url')) {
    const bare = specifier.slice(0, -4);
    let file = null;
    if (bare.startsWith('.')) {
      file = tryFile(join(dirname(fileURLToPath(context.parentURL)), bare));
    } else {
      try {
        file = require.resolve(bare);
      } catch {
        file = null;
      }
    }
    if (file) {
      // Node 下 sql.js 走 fs 读取，因此导出普通文件路径而非 URL
      return { url: virtualModule(`export default ${JSON.stringify(file)};`), shortCircuit: true };
    }
  }
  // 3) 路径别名 @/ → src/
  if (specifier.startsWith('@/')) {
    const hit = tryFile(join(root, 'src', specifier.slice(2)));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  // 4) 相对路径省略扩展名
  if (specifier.startsWith('.') && context.parentURL) {
    const hit = tryFile(join(dirname(fileURLToPath(context.parentURL)), specifier));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
