/**
 * 界面探针：用无头 Chrome 量真实布局并出图
 * ==================================================================
 * 为什么留着它：这次修的四个问题（时间轴对不齐、游标不跟手、分隔条白条、
 * 窄屏两层排版叠在一起）全都是"看到才知道"的问题 —— 编译通过、测试全绿、
 * 模块 200 也说明不了排版对不对。沙箱里没有 Playwright，但 Node 自带
 * WebSocket、Chrome 自己就是 CDP 服务端，于是画布上的像素可以真的量出来。
 *
 * 用法（两个进程都要先起来）：
 *   1) node node_modules/vite/bin/vite.js                    # 5173
 *   2) chrome --headless=new --remote-debugging-port=9222 \
 *        --user-data-dir=%TEMP%\wf-probe about:blank
 *   3) node scripts/ui-probe.mjs [场景…]                      # 不写就跑全部
 *
 * 图存到 .probe/ 下（已在 .gitignore 里）。
 * 注意：Chrome 必须跑在沙箱之外（mojo 需要命名管道，scoop 会拒绝访问）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { openPage, sleep, waitForCdp } from './cdp.mjs';

const BASE = process.env.WF_URL ?? 'http://localhost:5173/';
const OUT = '.probe';
const only = process.argv.slice(2);

/** 等应用启动完成（sql.js + 种子数据）；evaluate 里是同步求值，所以忙等 */
const READY = `
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    const labels = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
    if (labels.includes('时间轴') && labels.includes('设置')) return 'ready';
    const t = Date.now(); while (Date.now() - t < 50);
  }
  return 'timeout:' + document.body.innerText.slice(0, 200);
`;

const CLICK_MODULE = (label) => `
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)});
  if (!btn) return 'no-button';
  btn.click();
  return 'ok';
`;

/** 点开卡片网格里的第一张卡（侧栏筛选按钮里也有同样的标题，所以按摘要行区分） */
const OPEN_CARD = `
  const tiles = [...document.querySelectorAll('button')].filter(
    (b) => /灵息|灰烬|薇拉|阿舒尔|焚天|灰港/.test(b.textContent)
      && [...b.querySelectorAll('*')].some((n) => /text-muted-foreground/.test(String(n.className)) && !n.children.length),
  );
  if (!tiles.length) return 'no-tile';
  tiles[0].click();
  return 'ok:' + tiles.length;
`;

const SET_THEME = (theme) => `
  document.documentElement.classList.toggle('dark', ${JSON.stringify(theme)} === 'dark');
  return document.documentElement.className;
`;

/** 时间轴：刻度、条目、被裁掉的条目、横向滚动量 —— 对齐问题的全部证据 */
const TIMELINE = `
  const wrap = document.querySelector('.overflow-auto');
  const inner = wrap.firstElementChild;
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) }; };
  const axis = document.querySelector('.cursor-crosshair');
  const ticks = [...axis.querySelectorAll('span')].filter((s) => /年/.test(s.textContent))
    .map((s) => ({ t: s.textContent.trim(), x: Math.round(s.parentElement.getBoundingClientRect().left) }));
  const entries = [...inner.querySelectorAll('div[title],button[title]')]
    .filter((e) => /拖动/.test(e.title || ''))
    .map((e) => { const r = e.getBoundingClientRect();
      return { t: e.title.split('\\n')[0], x: Math.round(r.left), right: Math.round(r.right) }; });
  return { scroll: { left: wrap.scrollLeft, width: wrap.scrollWidth, client: wrap.clientWidth },
           content: box(inner), axis: box(axis), ticks, clipped: entries.filter((e) => e.right > box(inner).right) };
`;

/** 面板与背板：窄屏"两层排版叠在一起"的证据 */
const PANELS = `
  const panels = [...document.querySelectorAll('aside')].map((a) => {
    const r = a.getBoundingClientRect();
    const cs = getComputedStyle(a);
    return { head: (a.querySelector('header')?.textContent || '').slice(0, 8),
             x: Math.round(r.left), w: Math.round(r.width), pos: cs.position,
             cssW: cs.width, styleW: a.getAttribute('style'),
             hasMin: String(a.className).indexOf('min(var') >= 0 };
  }).filter((p) => p.w > 0);
  const scrims = [...document.querySelectorAll('[data-wf-scrim]')].map((d) => {
    const cs = getComputedStyle(d);
    return { which: d.dataset.wfScrim, display: cs.display, covers: cs.display !== 'none' };
  });
  const root = getComputedStyle(document.documentElement);
  return { main: (() => { const r = document.querySelector('main').getBoundingClientRect();
             return { x: Math.round(r.left), w: Math.round(r.width) }; })(),
           vars: { inspector: root.getPropertyValue('--wf-inspector-w'),
                   drawer: root.getPropertyValue('--wf-inspector-w-drawer'),
                   sideDrawer: root.getPropertyValue('--wf-sidebar-w-drawer') },
           panels, scrims };
`;

async function shoot(page, name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
}

const viewport = (page, width, height = 860, mobile = false) =>
  page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });

const SCENES = {
  /** 时间轴：1440 宽下点 100 年刻度，游标线必须与刻度同 x */
  async timeline(page) {
    await viewport(page, 1440);
    console.log('  切到时间轴：', await page.evaluate(CLICK_MODULE('时间轴')));
    await sleep(1200);
    await shoot(page, 'timeline-1440');
    const geo = await page.evaluate(TIMELINE);
    console.log('  刻度 =', geo.ticks.map((t) => `${t.t}@${t.x}`).join(' '));
    console.log('  横向滚动 =', JSON.stringify(geo.scroll), '内容 =', JSON.stringify(geo.content));
    console.log('  被裁条目 =', JSON.stringify(geo.clipped));

    const tick = geo.ticks.find((t) => t.t.startsWith('100 '));
    if (!tick) return console.log('  没找到 100 年刻度');
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tick.x, y: 100, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tick.x, y: 100, button: 'left', clickCount: 1 });
    await sleep(400);
    const after = await page.evaluate(`
      const axis = document.querySelector('.cursor-crosshair');
      const axisLine = [...axis.children].find((c) => /bg-primary/.test(String(c.className)));
      const lane = [...document.querySelectorAll('div')].find(
        (d) => /border-b border-border\\/60/.test(String(d.className)) && d.style.height === '40px');
      const laneLine = lane ? [...lane.children].find((c) => /bg-primary/.test(String(c.className))) : null;
      const bar = document.body.innerText.match(/游标\\s*([-\\d.]+)/);
      return { value: bar ? bar[1] : null,
               axisLine: axisLine ? Math.round(axisLine.getBoundingClientRect().left) : null,
               laneLine: laneLine ? Math.round(laneLine.getBoundingClientRect().left) : null };
    `);
    await shoot(page, 'timeline-cursor');
    console.log(`  点刻度 x=${tick.x} → 游标=${after.value}，刻度尺线=${after.axisLine}，泳道线=${after.laneLine}`);
  },

  /** 卡片详情在各宽度下的面板状态与重叠 */
  async card(page) {
    await viewport(page, 1440, 900);
    await page.evaluate(CLICK_MODULE('卡片 Wiki'));
    await sleep(900);
    console.log('  打开卡片：', await page.evaluate(OPEN_CARD));
    await sleep(700);
    for (const width of [1440, 1024, 900, 730, 662, 520, 360]) {
      await viewport(page, width, 900);
      await sleep(500);
      await page.evaluate(SET_THEME('dark'));
      await sleep(200);
      await shoot(page, `card-${width}`);
      console.log(`  ${String(width).padStart(4)}px`, JSON.stringify(await page.evaluate(PANELS)));
    }
    // 详情页内部：左列（正文/字段）与右列是否互相盖住
    await viewport(page, 662, 900);
    await sleep(400);
    const detail = await page.evaluate(`
      const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
      const grid = document.querySelector('main div[class*="grid-cols-1"]');
      const editor = document.querySelector('textarea');
      const fields = [...document.querySelectorAll('section')].find((s) => s.textContent.trim().startsWith('结构化字段'));
      const wrap = editor ? editor.closest('div.flex') : null;
      return { grid: box(grid), gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
               col1: grid ? box(grid.children[0]) : null, col2: grid ? box(grid.children[1]) : null,
               editor: box(editor), editorWrap: box(wrap), fields: box(fields) };
    `);
    console.log('  详情布局 =', JSON.stringify(detail));
  },
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  await waitForCdp();
  const page = await openPage(BASE);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await sleep(2500);
  console.log('app:', await page.evaluate(READY));

  for (const [name, fn] of Object.entries(SCENES)) {
    if (only.length && !only.includes(name)) continue;
    console.log(`场景 ${name}：`);
    await fn(page);
  }
  page.close();
}

main().catch((err) => {
  console.error('探针失败：', err.message);
  process.exit(1);
});
