/**
 * 深海配色（内置插件）的断言用例
 * ------------------------------------------------------------------
 * 由 scripts/theme-selftest.mjs 调用；共用的配色表读取与 WCAG 数学在
 * scripts/palette-lib.mjs。用例仍随 `node scripts/theme-selftest.mjs` 一起跑、
 * 一起进同一份汇总（测试运行器的计数是进程级的，与文件无关）。
 *
 * 2026-10-03 把插件从「只给 8 个变量」补全到 19 个，这里守五条：
 *   1. 键集合：两套主题都给齐 index.css 的 19 个调色板变量；
 *   2. 色相窗口：深海收在 187–205°、羊皮纸收在 28–42°，破坏性色保持红；
 *   3. 对比度：13 对前景/面 × 亮暗共 26 组里，除白名单那一处外必须全部 ≥ 4.5
 *      （2026-10-03 时还有 5 处不达标，2026-10-04 修好 4 处，只剩「亮色主色按钮上的
 *      白字」一处继续"锁住不恶化" —— 主色 45% 是用户定的审美优先项）；
 *   4. 语义锁定：ring==primary、各 *-foreground==foreground、input 与 border 的关系；
 *   5. 逐值 golden：19 个值就是定稿值 —— 改色必须同步改这里。
 */
import { test, assert } from './test-runner.mjs';
import { hslParts, ratio, read } from './palette-lib.mjs';

const THEME_SRC = read('plugins/deepsea-theme.js');

/** index.css 的 :root 就是调色板变量名的全集（19 个；.dark 那套键名相同，不重复数） */
const CSS_KEYS = [...(/:root\s*\{([\s\S]*?)\}/.exec(read('src/index.css'))?.[1] ?? '')
  .matchAll(/(--[\w-]+)\s*:/g)]
  .map((m) => m[1])
  .filter((k) => !k.startsWith('--wf-') && k !== '--radius');

/** 从插件源码里抠出某个主题的 vars —— 19 个值以插件源码为唯一真相源 */
function varsOf(id) {
  const from = THEME_SRC.indexOf(`id: '${id}'`);
  assert.ok(from >= 0, `plugins/deepsea-theme.js 里没找到主题 ${id}`);
  const rest = THEME_SRC.slice(from);
  const next = rest.indexOf('registerTheme(');
  const block = next >= 0 ? rest.slice(0, next) : rest;
  const pairs = [...block.matchAll(/'(--[\w-]+)':\s*'([^']+)'/g)];
  assert.ok(pairs.length >= 19, `${id} 只解析出 ${pairs.length} 个变量，解析可能失效`);
  return Object.fromEntries(pairs.map((m) => [m[1], m[2]]));
}

const LIGHT = varsOf('parchment-light');
const DARK = varsOf('deepsea-dark');
/** [叫法, 变量表, 色相下限, 色相上限] */
const MODES = [['亮', LIGHT, 28, 42], ['暗', DARK, 187, 205]];

/** 定稿值（2026-10-03 用户在 24 张预览图上确认；2026-10-04 微调两处 muted-foreground）：变量 → [亮, 暗] */
const GOLDEN = {
  '--background': ['42 45% 96%', '205 45% 7%'],
  '--foreground': ['30 25% 15%', '195 30% 92%'],
  '--card': ['42 50% 98%', '205 42% 10%'],
  '--card-foreground': ['30 25% 15%', '195 30% 92%'],
  '--popover': ['42 60% 99%', '205 45% 12%'],
  '--popover-foreground': ['30 25% 15%', '195 30% 92%'],
  '--primary': ['28 75% 45%', '187 85% 53%'],
  '--primary-foreground': ['42 50% 98%', '205 45% 8%'],
  '--secondary': ['40 35% 92%', '205 32% 14%'],
  '--secondary-foreground': ['30 25% 15%', '195 30% 92%'],
  '--muted': ['42 30% 90%', '205 30% 16%'],
  '--muted-foreground': ['35 16% 38%', '200 20% 66%'],
  '--accent': ['42 40% 88%', '187 40% 20%'],
  '--accent-foreground': ['30 25% 15%', '195 30% 92%'],
  '--destructive': ['0 65% 45%', '0 55% 48%'],
  '--destructive-foreground': ['0 0% 98%', '0 0% 98%'],
  '--border': ['38 25% 80%', '205 30% 20%'],
  '--input': ['38 25% 80%', '205 30% 22%'],
  '--ring': ['28 75% 45%', '187 85% 53%'],
};

/** 会真正叠在一起的前景/面组合（不是穷举：*-foreground 只对各自的面） */
const PAIRS = [
  ['--foreground', '--background'], ['--card-foreground', '--card'], ['--popover-foreground', '--popover'],
  ['--secondary-foreground', '--secondary'], ['--accent-foreground', '--accent'],
  ['--primary-foreground', '--primary'], ['--destructive-foreground', '--destructive'],
  ['--muted-foreground', '--background'], ['--muted-foreground', '--card'], ['--muted-foreground', '--popover'],
  ['--muted-foreground', '--muted'], ['--muted-foreground', '--secondary'], ['--muted-foreground', '--accent'],
];

/**
 * 唯一一处仍低于 4.5 的组合：亮色主色按钮上的白字（45% 主色下 3.57）。
 * 2026-10-04 用户拍板「主色保持 45%，审美优先」，所以它继续"锁住不恶化"。
 * 它的两个色值本身由下面的 golden 用例逐字锁住 → 3.57 不可能自己漂走，
 * 这里的 ≥3.5 只是兜底；白名单之外必须一处都不低于 4.5。
 */
const KNOWN_GAPS = ['亮 --primary-foreground on --primary'];

/** 2026-10-04 修好的四处（原白名单里的后四条）：逐条点名要求 ≥4.5，掉回来要能一眼看出是哪一对 */
const FIXED_GAPS = [
  ['亮', '--muted-foreground', '--muted'],
  ['亮', '--muted-foreground', '--secondary'],
  ['亮', '--muted-foreground', '--accent'],
  ['暗', '--muted-foreground', '--accent'],
];

/** 深海配色：6 条用例（由 theme-selftest.mjs 的分组标题引出） */
export async function runDeepseaCases() {
  await test('键集合：两套主题都给齐 19 个调色板变量，与 index.css 的变量名一一对应', () => {
    assert.equal(CSS_KEYS.length, 19, `index.css 里解析出 ${CSS_KEYS.length} 个调色板变量，解析可能失效`);
    for (const [name, vars] of MODES) {
      assert.deepEqual(Object.keys(vars).sort(), [...CSS_KEYS].sort(), `${name}色的键集合对不上`);
    }
  });

  await test('色相窗口：深海 187–205°、羊皮纸 28–42°，破坏性色仍是红', () => {
    for (const [name, vars, lo, hi] of MODES) {
      for (const [key, value] of Object.entries(vars)) {
        const [h, s] = hslParts(value);
        if (key === '--destructive') {
          assert.ok(h <= 15 && s >= 40, `${name}色 ${key} 不再是红：${value}`);
        } else if (s > 0) {
          assert.ok(h >= lo && h <= hi, `${name}色 ${key} 的色相 ${h}° 不在 ${lo}–${hi}°：${value}`);
        }
      }
    }
  });

  await test('当年那处不达 AA 已修好：亮色 muted-foreground 对羊皮纸底 ≥4.5', () => {
    const r = ratio(LIGHT['--muted-foreground'], LIGHT['--background']);
    assert.ok(r >= 4.5, `实测只有 ${r.toFixed(2)}（补全前 4.40，默认调色板下 4.38）`);
  });

  await test('对比度：正文与次要文字对各自的面 ≥4.5，低于 4.5 的只剩白名单', () => {
    const gaps = [];
    for (const [name, vars] of MODES) {
      for (const [fg, bg] of PAIRS) {
        const r = ratio(vars[fg], vars[bg]);
        if (r < 4.5) gaps.push(`${name} ${fg} on ${bg} ${r.toFixed(2)}`);
      }
    }
    const keys = gaps.map((g) => g.split(' ').slice(0, 4).join(' '));
    assert.deepEqual(keys.sort(), [...KNOWN_GAPS].sort(), `低于 4.5 的组合变了：${gaps.join('；') || '一处都没有'}`);
    for (const g of gaps) assert.ok(Number(g.split(' ').pop()) >= 3.5, `已知缺口继续恶化：${g}`);
    // 2026-10-04 修好的四处：逐条点名，不许再掉回 4.5 以下
    for (const [name, fg, bg] of FIXED_GAPS) {
      const vars = name === '亮' ? LIGHT : DARK;
      const r = ratio(vars[fg], vars[bg]);
      assert.ok(r >= 4.5, `${name} ${fg} on ${bg} 实测只有 ${r.toFixed(2)}（2026-10-04 已修好）`);
    }
  });

  await test('语义锁定：ring==primary、各 *-foreground==foreground、input 与 border 的关系', () => {
    // 0.1.0 就有的 8 个值（底色 / 主色 / 主色字 / 边框）也在这套关系里，
    // 它们的具体色值由下一个 golden 用例一并锁住 —— 本轮的补全一个都没动。
    for (const [name, vars] of MODES) {
      assert.equal(vars['--ring'], vars['--primary'], `${name}色聚焦环没跟主色走`);
      for (const key of ['--card-foreground', '--popover-foreground', '--secondary-foreground', '--accent-foreground']) {
        assert.equal(vars[key], vars['--foreground'], `${name}色 ${key} 与 foreground 不一致`);
      }
      const [ih, is, il] = hslParts(vars['--input']);
      const [bh, bs, bl] = hslParts(vars['--border']);
      if (name === '亮') {
        assert.equal(vars['--input'], vars['--border'], '亮色 input 应与 border 同色');
      } else {
        assert.ok(ih === bh && is === bs && il - bl === 2, `暗色 input 应在 border 基础上亮 2 点：${vars['--input']} vs ${vars['--border']}`);
      }
      assert.ok(hslParts(vars['--popover'])[2] > hslParts(vars['--card'])[2], `${name}色浮层应比卡片亮一档`);
    }
  });

  await test('19 个值逐一等于定稿值（golden，改色必须同步改这里）', () => {
    assert.equal(Object.keys(GOLDEN).length, 19);
    for (const [key, [light, dark]] of Object.entries(GOLDEN)) {
      assert.equal(LIGHT[key], light, `亮色 ${key}`);
      assert.equal(DARK[key], dark, `暗色 ${key}`);
    }
  });
}
