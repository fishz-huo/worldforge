/**
 * 内置示例插件
 * ------------------------------------------------------------------
 * 它们不是「内置功能」，而是三份可以直接阅读、复制、改造的插件源码，
 * 用来说明插件插口能做什么。用户可以在插件页停用或删除它们。
 *
 * 注意：插件以 Blob 模块载入，不能 `import 'react'`，
 * 需要 React 时使用 `const { React } = api.ui`。
 */

/** 插件 1：主题插件 —— 注册两套配色 */
export const THEME_PLUGIN = /* js */ `
export const manifest = {
  id: 'builtin.deepsea',
  name: '深海配色',
  version: '0.1.0',
  author: 'WorldForge 内置示例',
  description: '提供「深海 · 暗」「羊皮纸 · 亮」两套配色，可在 设置 → 外观 中选用。',
};

export function activate(api) {
  api.registerTheme({
    id: 'deepsea-dark', name: '深海 · 暗', mode: 'dark',
    vars: {
      '--background': '205 45% 7%', '--foreground': '195 30% 92%',
      '--card': '205 42% 10%', '--muted': '205 30% 16%',
      '--primary': '187 85% 53%', '--primary-foreground': '205 45% 8%',
      '--accent': '187 40% 20%', '--border': '205 30% 20%',
    },
  });
  api.registerTheme({
    id: 'parchment-light', name: '羊皮纸 · 亮', mode: 'light',
    vars: {
      '--background': '42 45% 96%', '--foreground': '30 25% 15%',
      '--card': '42 50% 98%', '--muted': '42 30% 90%',
      '--primary': '28 75% 45%', '--primary-foreground': '42 50% 98%',
      '--accent': '42 40% 88%', '--border': '38 25% 80%',
    },
  });
  api.registerCommand({
    id: 'deepsea.hint',
    title: '配色插件：如何切换主题',
    hint: '插件',
    run: () => api.toast('到「设置 → 外观 → 配色方案」即可选用本插件提供的主题', 'info'),
  });
}
`;

/** 插件 2：写作统计面板 —— 展示各文稿字数与卡片构成 */
export const STATS_PLUGIN = /* js */ `
export const manifest = {
  id: 'builtin.stats',
  name: '写作统计',
  version: '0.1.0',
  author: 'WorldForge 内置示例',
  description: '在插件面板里统计每篇文稿的字数与卡片类型分布。',
  settings: {
    showCards: { type: 'boolean', label: '显示卡片类型分布', default: true },
    warnAt: { type: 'number', label: '单篇字数预警线', default: 5000, hint: '超过该字数以橙色显示' },
  },
};

export function activate(api) {
  const { React } = api.ui;
  const h = React.createElement;

  const countWords = (text) => {
    const cjk = (text.match(/[\\u4e00-\\u9fa5]/g) || []).length;
    const words = (text.replace(/[\\u4e00-\\u9fa5]/g, ' ').match(/[A-Za-z0-9']+/g) || []).length;
    return cjk + words;
  };

  api.registerPanel({
    id: 'stats.panel',
    title: '写作统计',
    icon: 'BarChart3',
    render: () => {
      const docs = api.query.listDocs();
      const cards = api.query.listCards();
      const warnAt = Number(api.settings.warnAt) || 5000;
      const rows = docs.map((d) =>
        h('div', { key: d.id, className: 'flex items-center justify-between gap-2 py-1 text-xs' },
          h('span', { className: 'truncate text-muted-foreground' }, d.title),
          h('span', { className: countWords(d.content) > warnAt ? 'text-amber-400 font-mono' : 'font-mono text-foreground' },
            countWords(d.content) + ' 字'),
        ),
      );
      const byType = {};
      cards.forEach((c) => { byType[c.type] = (byType[c.type] || 0) + 1; });
      const total = docs.reduce((sum, d) => sum + countWords(d.content), 0);
      return h('div', { className: 'space-y-2 p-1' },
        h('div', { className: 'text-xs text-muted-foreground' }, '全部文稿合计 ' + total + ' 字'),
        ...rows,
        api.settings.showCards !== false && h('div', { className: 'border-t border-border pt-2 mt-2 space-y-1' },
          h('div', { className: 'text-xs font-medium' }, '卡片构成'),
          ...Object.entries(byType).map(([k, v]) =>
            h('div', { key: k, className: 'flex justify-between text-xs text-muted-foreground' },
              h('span', null, k), h('span', { className: 'font-mono' }, String(v)))),
        ),
      );
    },
  });
}
`;

/** 插件 3：随机命名器 —— 演示 storage、command 与事件订阅 */
export const NAMER_PLUGIN = /* js */ `
export const manifest = {
  id: 'builtin.namer',
  name: '随机命名器',
  version: '0.1.0',
  author: 'WorldForge 内置示例',
  description: '一键生成人名与地名，可复制到剪贴板；演示插件私有存储与事件订阅。',
};

const SURNAME = ['烬', '薇', '索', '霜', '砚', '叶', '寒', '砚', '陆', '黎'];
const GIVEN = ['阿舒尔', '澜', '照', '与真', '青梧', '望舒', '归尘', '无咎', '长庚', '雪见'];
const PLACE_A = ['灰', '北', '烬', '云', '铁', '霜', '赤', '幽'];
const PLACE_B = ['港', '关', '岭', '原', '渡', '城', '峡', '泽'];

export function activate(api) {
  const { React } = api.ui;
  const h = React.createElement;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const person = () => pick(SURNAME) + '·' + pick(GIVEN);
  const place = () => pick(PLACE_A) + pick(PLACE_B);

  const remember = (kind, name) => {
    const list = api.storage.get(kind, []);
    api.storage.set(kind, [name, ...list].slice(0, 12));
  };

  api.registerCommand({
    id: 'namer.person', title: '生成一个人名', hint: '命名器',
    run: () => { const n = person(); remember('persons', n); api.toast('人名：' + n, 'success'); },
  });
  api.registerCommand({
    id: 'namer.place', title: '生成一个地名', hint: '命名器',
    run: () => { const n = place(); remember('places', n); api.toast('地名：' + n, 'success'); },
  });

  api.registerPanel({
    id: 'namer.panel', title: '随机命名器', icon: 'Dices',
    render: () => {
      const persons = api.storage.get('persons', []);
      const places = api.storage.get('places', []);
      const button = (label, onClick) =>
        h('button', {
          onClick, className: 'rounded border border-border bg-muted px-2 py-1 text-xs hover:bg-accent',
        }, label);
      const list = (title, items) => h('div', { className: 'space-y-1' },
        h('div', { className: 'text-xs font-medium' }, title),
        items.length === 0
          ? h('div', { className: 'text-xs text-muted-foreground' }, '还没有记录')
          : items.map((n, i) => h('div', { key: i, className: 'text-xs text-muted-foreground' }, n)));
      return h('div', { className: 'space-y-3 p-1' },
        h('div', { className: 'flex gap-2' },
          button('人名', () => { const n = person(); remember('persons', n); api.toast(n, 'success'); }),
          button('地名', () => { const n = place(); remember('places', n); api.toast(n, 'success'); })),
        list('最近人名', persons), list('最近地名', places));
    },
  });

  api.on('card:save', (card) => {
    if (card && /未命名/.test(card.title || '')) api.toast('卡片「' + card.title + '」还没起名字', 'warn');
  });
}
`;

/** 内置插件清单：id → 源码 */
export const BUILTIN_PLUGINS: { id: string; name: string; description: string; code: string }[] = [
  { id: 'builtin.deepsea', name: '深海配色', description: '两套配色方案，可在设置中选用', code: THEME_PLUGIN },
  { id: 'builtin.stats', name: '写作统计', description: '统计文稿字数与卡片构成', code: STATS_PLUGIN },
  { id: 'builtin.namer', name: '随机命名器', description: '一键生成人名地名，可留档', code: NAMER_PLUGIN },
];
