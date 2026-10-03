/**
 * 自测（三十四）：主题变量作用域
 * ------------------------------------------------------------------
 * 用法：node scripts/theme-selftest.mjs
 *
 * 这里守的是一条契约，而不是某个颜色：**宿主写过的主题变量，必须在每次应用
 * 之前被清掉**。因为内联样式只会新增、不会自己消失，插件一停用，旧值就会继续
 * 盖住 index.css 里的亮暗两套 —— 表现为「切亮暗只有一部分元素变化」（实测
 * 19 个主题变量里只有 9 个会动）。所以：
 *   1. 换主题 / 停用插件时，旧变量一个都不能留（传 null 必须清空）；
 *   2. 清理要发生在写入之前（顺序错了就等于没清）；
 *   3. 非法值不许把已有的主题变量抹坏。
 */
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const { createThemeScope } = await import('@/lib/theme-scope.ts');

/** 假宿主：像真的 CSSStyleDeclaration 一样记录每一步操作，便于断言顺序 */
function fakeHost() {
  const style = new Map();
  const ops = [];
  return {
    style,
    ops,
    setProperty: (k, v) => {
      style.set(k, v);
      ops.push('set:' + k);
    },
    removeProperty: (k) => {
      style.delete(k);
      ops.push('del:' + k);
    },
  };
}

/** 插件主题的真实形态：只覆盖一部分变量（深海配色就只给 8 个） */
const DARK = { '--background': '205 45% 7%', '--primary': '187 85% 53%', '--border': '205 30% 20%' };
const LIGHT = { '--background': '42 45% 96%', '--primary': '28 75% 45%', '--border': '38 25% 80%' };

group('应用与清理');
await test('应用一套变量后，作用域里就是这套变量', () => {
  const host = fakeHost();
  const scope = createThemeScope(host);
  scope.apply(DARK);
  assert.deepEqual([...host.style.keys()].sort(), Object.keys(DARK).sort());
  assert.deepEqual(scope.keys().sort(), Object.keys(DARK).sort());
});

await test('换一套变量：先逐个删掉上一套，再写新的（顺序断言）', () => {
  const host = fakeHost();
  const scope = createThemeScope(host);
  scope.apply(DARK);
  host.ops.length = 0;
  scope.apply(LIGHT);
  const dels = host.ops.filter((o) => o.startsWith('del:'));
  const sets = host.ops.filter((o) => o.startsWith('set:'));
  assert.deepEqual(dels.sort(), Object.keys(DARK).map((k) => 'del:' + k).sort(), '上一套必须先被删掉');
  assert.equal(host.ops.indexOf(sets[0]) > host.ops.indexOf(dels[dels.length - 1]), true, '删除要全部发生在写入之前');
  assert.deepEqual([...host.style.keys()].sort(), Object.keys(LIGHT).sort());
});

await test('传 null = 插件被停用：全部删掉，一个变量都不留', () => {
  const host = fakeHost();
  const scope = createThemeScope(host);
  scope.apply(DARK);
  scope.apply(null);
  assert.equal(host.style.size, 0, '停用后 <html> 上不能再有任何主题变量');
  assert.deepEqual(scope.keys(), []);
});

await test('空对象 {} 与 null 等效：只清不写，回到默认调色板', () => {
  const host = fakeHost();
  const scope = createThemeScope(host);
  scope.apply(DARK);
  scope.apply({});
  assert.equal(host.style.size, 0);
});

await test('反复清空是幂等的（第二次没有可删的也算通过）', () => {
  const host = fakeHost();
  const scope = createThemeScope(host);
  scope.apply(DARK);
  scope.apply(null);
  scope.apply(null);
  assert.equal(host.style.size, 0);
  assert.equal(scope.keys().length, 0);
});

await test('同一套变量连用两次：键不会重复累积', () => {
  const host = fakeHost();
  const scope = createThemeScope(host);
  scope.apply(DARK);
  scope.apply(DARK);
  assert.deepEqual(scope.keys().sort(), Object.keys(DARK).sort());
  assert.equal(host.style.size, Object.keys(DARK).length);
});

group('非法值守卫（插件写坏了也不许把主题变量抹掉）');
await test('空字符串的值被跳过', () => {
  const host = fakeHost();
  createThemeScope(host).apply({ '--primary': '  ' });
  assert.equal(host.style.size, 0);
});
await test('非 -- 开头的键被跳过', () => {
  const host = fakeHost();
  createThemeScope(host).apply({ color: 'red', background: 'black' });
  assert.equal(host.style.size, 0);
});
await test('非字符串的值被跳过', () => {
  const host = fakeHost();
  createThemeScope(host).apply({ '--primary': null, '--border': 42 });
  assert.equal(host.style.size, 0);
});
await test('部分合法：只写合法的那些，键集合同步', () => {
  const host = fakeHost();
  const scope = createThemeScope(host);
  scope.apply({ '--primary': '187 85% 53%', '--bad': '', bogus: 'x' });
  assert.deepEqual([...host.style.keys()], ['--primary']);
  assert.deepEqual(scope.keys(), ['--primary']);
});

group('回归守卫：防止旧写法复活');
const read = (p) => readFileSync(p, 'utf8');
await test('App.tsx 不再把 --primary / --ring 写成内联样式（强调色已下线）', () => {
  const src = read('src/App.tsx');
  assert.equal(/style\.setProperty\(\s*'--(primary|ring)'/.test(src), false, '强调色写入必须已删除');
});
await test('App.tsx 通过 applyPluginTheme 应用插件主题', () => {
  const src = read('src/App.tsx');
  assert.equal(src.includes('applyPluginTheme('), true);
  assert.equal(src.includes("from '@/lib/theme-scope'"), true);
});
await test('商店与偏好里不再有 accent 字段', () => {
  for (const p of ['src/store/prefs.ts', 'src/store/types.ts', 'src/store/slices/uiSlice.ts']) {
    const src = read(p);
    assert.equal(/\baccent\b/.test(src.replace(/\/\*\*[\s\S]*?\*\//g, '')), false, p + ' 里还残留 accent');
  }
});
await test('设置页不再有强调色选择器，且仍是 200 行以内', () => {
  const src = read('src/features/settings/AppearanceSettings.tsx');
  assert.equal(src.includes('ACCENTS'), false);
  assert.equal(src.includes('setAccent'), false);
  assert.equal(src.split('\n').length - 1 <= 200, true, '单文件 200 行红线');
});
await test('偏好读取会丢弃已下线的老字段（不写回、也不删数据）', () => {
  const src = read('src/store/prefs.ts');
  assert.equal(src.includes('pickKnownPrefs'), true);
  assert.equal(src.includes('Object.keys(DEFAULT_PREFS)'), true);
});

finish('主题变量作用域');
