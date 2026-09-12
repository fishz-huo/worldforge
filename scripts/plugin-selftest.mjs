/**
 * 自测（八）：插件源码与宿主契约
 * ------------------------------------------------------------------
 * 用法：node scripts/plugin-selftest.mjs
 *
 * 插件与宿主之间有几处「写错了也不报错，只是静默失效」的耦合，
 * typecheck / 构建 / 运行时都拦不住，所以单独守住：
 *   1. 插件调用了 PluginAPI 里不存在的成员；
 *   2. 插件依赖的 DOM 契约（data-wf-*）被宿主改名或删掉 → 插件永远找不到图；
 *   3. 插件里写了 import、监听没有配套移除、设置项声明了却没人读；
 *   4. 内置清单 ?raw 引用的插件文件与 manifest 的 id 对不上。
 * 检查器本身先用可证伪样本验证有效，再对真实插件要求零违规。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { register } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ghostApiMembers, importStatements, pluginShapeProblems, requiredContracts,
  uncleanListeners, unusedSettings,
} from './plugin-lint.mjs';
import { extractInterfaces } from './spec-lint.mjs';
import { assert, finish, group, test } from './test-runner.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLUGIN_DIR = join(ROOT, 'plugins');

/* --------------------------- 准备真实数据 --------------------------- */

/** PluginAPI 的成员清单 = 插件能用的全部能力 */
const apiMembers = extractInterfaces([
  { fileName: 'plugin-api.ts', text: readFileSync(join(ROOT, 'src/types/plugin-api.ts'), 'utf8') },
]).get('PluginAPI').members;

/** 递归读取目录下所有源码文本 */
function readSources(dir, filter, out = []) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) readSources(full, filter, out);
    else if (filter(item.name) && statSync(full).isFile()) out.push({ file: full, text: readFileSync(full, 'utf8') });
  }
  return out;
}

/** 宿主源码：用来确认插件依赖的 DOM 契约真的被渲染出来了 */
const hostText = readSources(join(ROOT, 'src'), (n) => /\.tsx?$/.test(n)).map((f) => f.text).join('\n');

/** plugins/ 下的每个 .js 就是一个插件 */
const plugins = readdirSync(PLUGIN_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.js'))
  .map((e) => ({ name: e.name, file: join(PLUGIN_DIR, e.name), text: readFileSync(join(PLUGIN_DIR, e.name), 'utf8') }));

const builtinsText = readFileSync(join(ROOT, 'src/lib/plugin/builtins.ts'), 'utf8');

/** 一份「合法插件」样本：检查器不得误报 */
const GOOD_PLUGIN = `
export const manifest = {
  id: 'good.demo',
  name: '示例',
  settings: {
    loop: { type: 'boolean', label: '循环', default: true },
  },
};
export function activate(api) {
  const view = document.createElement('div');
  view.addEventListener('click', () => {});
  document.addEventListener('click', onClick, true);
  function onClick() { if (api.settings.loop && api.storage.get('x', 0)) api.toast('ok'); }
  return () => document.removeEventListener('click', onClick, true);
}`;

/** 一份「有问题」的样本：声明了设置项却从没读过 */
const DEAD_SETTING_PLUGIN = `
export const manifest = {
  id: 'bad.demo',
  name: '示例',
  settings: {
    ghost: { type: 'boolean', label: '没人用', default: true },
  },
};
export function activate() {}`;

group('检查器自身有效性');

await test('能检出：调用了 PluginAPI 里不存在的成员（指南里的幽灵接口）', () => {
  const bad = `export function activate(api) { api.cards.query({ type: 'character' }); }`;
  assert.deepEqual(ghostApiMembers(bad, apiMembers), ['cards']);
  assert.deepEqual(ghostApiMembers(GOOD_PLUGIN, apiMembers), [], '合法样本不该被误报');
});

await test('能检出：插件里出现 import（Blob 模块解析不了裸模块名）', () => {
  assert.equal(importStatements(`import { x } from 'lodash';\nexport function activate() {}`).length, 1);
  // 注释里出现 import 这个词，不能被当成语句
  assert.equal(importStatements(`// 不能写 import 'react'\nexport function activate() {}`).length, 0);
  assert.equal(importStatements(GOOD_PLUGIN).length, 0);
});

await test('能检出：全局监听没有配套移除（停用后留残余）', () => {
  const bad = `export function activate() { document.addEventListener('click', h, true); }`;
  assert.deepEqual(uncleanListeners(bad), ['click']);
  // 元素级监听随节点一起消失，不该要求手动移除
  const local = `const view = document.createElement('div');\nview.addEventListener('click', h);`;
  assert.deepEqual(uncleanListeners(local), []);
  assert.deepEqual(uncleanListeners(GOOD_PLUGIN), [], '合法样本不该被误报');
});

await test('能检出：声明了设置项却从没读过', () => {
  assert.deepEqual(unusedSettings(DEAD_SETTING_PLUGIN), ['ghost']);
  assert.deepEqual(unusedSettings(GOOD_PLUGIN), []);
});

await test('能检出：缺少 activate / manifest / 清理函数', () => {
  assert.equal(pluginShapeProblems(`export function activate() {}`).length, 2);
  assert.equal(pluginShapeProblems(GOOD_PLUGIN).length, 0);
});

await test('能检出：插件依赖了宿主里不存在的 DOM 契约', () => {
  const fake = 'img[data-wf-zoom][data-wf-nothing]';
  assert.ok(requiredContracts(fake).includes('data-wf-nothing'), '检查器没抽出契约属性');
  assert.equal(requiredContracts(GOOD_PLUGIN).length, 0);
});

group('插件源码扫描');

await test(`扫描 ${plugins.length} 个插件文件：幽灵接口 / import / 监听残留 / 死设置 / 形状 零违规`, () => {
  assert.ok(plugins.length > 0, 'plugins/ 下没有找到任何 .js 插件');
  const problems = [];
  for (const p of plugins) {
    const where = relative(ROOT, p.file);
    ghostApiMembers(p.text, apiMembers).forEach((n) => problems.push(`${where}：api.${n} 不在 PluginAPI 里`));
    importStatements(p.text).forEach((s) => problems.push(`${where}：不允许 import（${s}）`));
    uncleanListeners(p.text).forEach((t) => problems.push(`${where}：${t} 监听没有 removeEventListener`));
    unusedSettings(p.text).forEach((k) => problems.push(`${where}：设置项 ${k} 声明了却没用`));
    pluginShapeProblems(p.text, p.name).forEach((msg) => problems.push(`${where}：${msg}`));
  }
  assert.equal(problems.length, 0, `发现 ${problems.length} 处问题：\n    ${problems.join('\n    ')}`);
});

await test('插件依赖的 DOM 契约在宿主源码里真实存在（否则插件永远找不到图）', () => {
  const missing = [];
  for (const p of plugins) {
    for (const attr of requiredContracts(p.text)) {
      if (!hostText.includes(attr)) missing.push(`${p.name} 需要 ${attr}，但 src/ 里没有这个标记`);
    }
  }
  assert.equal(missing.length, 0, `契约不匹配：\n    ${missing.join('\n    ')}`);
});

group('宿主接线');

await test('内置清单里每个 ?raw 引用的插件文件都存在，且 id 与 manifest 一致', () => {
  const imports = [...builtinsText.matchAll(/from\s+'([^']+)\?raw'/g)].map((m) => m[1]);
  assert.ok(imports.length > 0, '内置清单里没有 ?raw 引入的插件源码');
  for (const rel of imports) {
    const text = readFileSync(join(ROOT, 'src/lib/plugin', rel), 'utf8');
    const id = text.match(/export const manifest\s*=\s*\{[\s\S]*?id:\s*'([^']+)'/)?.[1];
    assert.ok(id, `${rel} 的 manifest 里找不到 id`);
    assert.ok(builtinsText.includes(`id: '${id}'`), `内置清单里没有 id: '${id}' 这一项`);
  }
});

await test('内置插件 id 不重复，且与各插件 manifest 的 id 对得上', () => {
  // 清单在文件末尾：只取 BUILTIN_PLUGINS 数组，避免把插件源码里的 id 也数进来
  const list = builtinsText.match(/export const BUILTIN_PLUGINS[\s\S]*$/)?.[0] ?? '';
  const listed = [...list.matchAll(/id:\s*'(builtin\.[\w.]+)'/g)].map((m) => m[1]);
  assert.ok(listed.length >= 4, `内置清单里只解析出 ${listed.length} 项，解析可能失效`);
  assert.equal(new Set(listed).size, listed.length, `内置插件 id 有重复：${listed.join(', ')}`);
  // 源码里写死的三个插件（第 4 个在 plugins/ 里，由上一个用例校验）
  const declared = [...builtinsText.matchAll(/export const manifest\s*=\s*\{[\s\S]*?id:\s*'(builtin\.[\w.]+)'/g)].map((m) => m[1]);
  assert.ok(declared.length >= 3, `只解析出 ${declared.length} 个 manifest，解析可能失效`);
  const off = declared.filter((id) => !listed.includes(id));
  assert.equal(off.length, 0, `manifest 里的 id 不在内置清单里：${off.join(', ')}`);
});

await test('api.settings 是实时访问器（改了设置不必重新启用插件）', async () => {
  register('./alias-hook.mjs', import.meta.url);
  const { createPluginAPI } = await import('@/lib/plugin/host.ts');
  const values = { warnAt: 1 };
  const bridge = { query: {}, toast: () => {}, readSettings: () => values, saveSettings: () => {}, applyManifest: () => {} };
  const record = {
    id: 'p.test', name: '测试插件', version: '0.1.0', author: '', description: '',
    code: '', enabled: 1, builtin: 0, settings_schema: {}, settings: {}, created_at: 0,
  };
  const api = createPluginAPI(record, bridge);
  assert.equal(api.settings.warnAt, 1);
  values.warnAt = 2; // 用户在设置表单里改了值
  assert.equal(api.settings.warnAt, 2, '又读到旧值：settings 退化成了 activate 时的快照');
  assert.equal(createPluginAPI(record, bridge).settings.warnAt, 2);
});

finish('插件与宿主契约');
