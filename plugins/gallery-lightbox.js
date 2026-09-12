/**
 * 插件：图库灯箱（点击放大 + 多图切换）
 * ==================================================================
 * 用法：点击图库里的图片 → 全屏放大；← → 或两侧箭头切换同组图片，滚轮缩放，
 *      Esc 或点击空白处关闭。
 *
 * 与宿主之间的 DOM 契约（宿主侧见 src/features/cards/CardGallery.tsx）：
 *   [data-wf-zoom]        标记「可以点开放大」的 <img>，值为资源 id（只作标记）
 *   [data-wf-zoom-group]  值相同的图片算一组，可在灯箱里左右切换；缺省即单图
 *
 * 为什么用事件委托而不是注册面板：v0.1 的 PluginAPI 没有「浮层插口」，也没有资源
 * 读取接口（插件拿不到图片 URL），而宿主已经把 objectURL 渲染进了页面上的 <img>。
 * 插件与宿主同上下文运行（v0.1 无沙箱，见插件开发指南 §1.3），直接接手这些已渲染
 * 好的图片成本最低：不复制图片、不改宿主数据，停用时把整块浮层移除。
 */
export const manifest = {
  id: 'builtin.lightbox',
  name: '图库灯箱',
  version: '0.1.0',
  author: 'WorldForge 内置示例',
  description: '点击图库里的图片即可放大预览，支持左右切换、键盘翻页与滚轮缩放。',
  settings: {
    arrows: { type: 'boolean', label: '两侧箭头与计数', default: true, hint: '多图时显示切换箭头与「3 / 8」计数' },
    loop: { type: 'boolean', label: '首尾循环切换', default: true, hint: '最后一张再按右键时回到第一张' },
    wheelZoom: { type: 'boolean', label: '滚轮缩放', default: true, hint: '关掉后滚轮不再缩放，避免误触' },
  },
};

const MIN_SCALE = 1; // 缩放范围：1 = 适应窗口
const MAX_SCALE = 6;

export function activate(api) {
  const doc = document;
  let box = null; // 灯箱根节点；非空即表示「已打开」
  let ui = null; // 灯箱内部节点引用
  let items = []; // 当前分组的图片（按 DOM 顺序 = 图库里的显示顺序）
  let idx = 0; // 正在看第几张
  let scale = 1; // 缩放倍率
  let prevOverflow = ''; // body 原本的 overflow

  /** 读设置：api.settings 是访问器，用户改设置后立即生效，无需重新启用插件 */
  const opt = (key, fallback) => (api.settings[key] === undefined ? fallback : api.settings[key]);

  /** 当前页面里可以放大的图片：隐藏的不算（display:none 的祖先拿不到矩形） */
  function zoomables() {
    const all = [...doc.querySelectorAll('img[data-wf-zoom]')];
    return all.filter((img) => !(box && box.contains(img)) && img.getClientRects().length > 0);
  }

  /** 与某张图同组的图片；没有分组标记时只有它自己 */
  function groupOf(img) {
    const group = img.getAttribute('data-wf-zoom-group');
    return group ? zoomables().filter((x) => x.getAttribute('data-wf-zoom-group') === group) : [img];
  }

  /** 灯箱骨架：静态结构一次建好，动态内容交给 paint() */
  function build() {
    const root = doc.createElement('div');
    root.className = 'fixed inset-0 z-[80] flex flex-col bg-black/85 backdrop-blur-sm';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '图片预览');
    const btn = 'rounded border border-white/15 bg-white/10 text-white/90 hover:bg-white/20';
    root.innerHTML = `
      <div class="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
        <span data-cap class="min-w-0 flex-1 truncate px-1 text-xs text-white/85"></span>
        <span data-count class="shrink-0 px-1 font-mono text-[11px] text-white/60"></span>
        <button data-close class="${btn} px-1.5 leading-4" title="关闭（Esc）">×</button>
      </div>
      <div data-stage class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        <img data-img class="max-h-full max-w-full select-none object-contain" alt="" draggable="false" />
        <button data-prev class="${btn} absolute left-2 top-1/2 -translate-y-1/2 px-2 py-1" title="上一张（←）">‹</button>
        <button data-next class="${btn} absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1" title="下一张（→）">›</button>
      </div>`;

    const part = {};
    for (const key of ['cap', 'count', 'close', 'stage', 'img', 'prev', 'next']) {
      part[key] = root.querySelector(`[data-${key}]`);
    }
    // 点在空白背景上才关闭；点图片本身不关闭
    part.stage.addEventListener('click', (e) => {
      if (e.target === part.stage) close();
    });
    part.stage.addEventListener('dblclick', () => zoomTo(MIN_SCALE)); // 双击复位
    part.stage.addEventListener('wheel', onWheel, { passive: false }); // 非 passive 才能 preventDefault
    part.close.addEventListener('click', close);
    part.prev.addEventListener('click', () => go(-1));
    part.next.addEventListener('click', () => go(1));
    return { root, ...part };
  }

  /** 把当前状态画到界面上 */
  function paint() {
    const img = items[idx];
    if (!img) return;
    ui.img.src = img.src; // 宿主已解析好的 objectURL，不重新读库
    ui.img.alt = ui.cap.textContent = img.getAttribute('alt') || '';
    const many = opt('arrows', true) && items.length > 1;
    for (const node of [ui.prev, ui.next]) node.style.visibility = many ? 'visible' : 'hidden';
    zoomTo(MIN_SCALE); // 换图后从「适应窗口」开始，顺带刷新顶部计数
  }

  /** 缩放（只放大图片本身，不做平移，实现保持简单）并刷新顶部计数 */
  function zoomTo(next) {
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(next) || MIN_SCALE));
    ui.img.style.transform = `scale(${scale})`;
    const pos = items.length > 1 ? `${idx + 1} / ${items.length}` : '';
    ui.count.textContent = scale > MIN_SCALE ? `${pos} · ${Math.round(scale * 100)}%` : pos;
  }

  function onWheel(event) {
    if (!opt('wheelZoom', true)) return;
    event.preventDefault();
    zoomTo(scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2));
  }

  /** 翻页：越界时按设置决定是否循环 */
  function go(step) {
    const current = items[idx];
    // 灯箱打开期间图库可能变了（换卡片、删图），每次翻页前重新取一次分组
    const fresh = current ? groupOf(current) : [];
    if (fresh.length) {
      idx = Math.max(0, fresh.indexOf(current));
      items = fresh;
    }
    if (items.length < 2) return;
    let next = idx + step;
    if (next < 0 || next >= items.length) {
      if (!opt('loop', true)) return;
      next = (next + items.length) % items.length;
    }
    idx = next;
    paint();
  }

  /** 打开灯箱 */
  function open(img) {
    if (box || !img.getAttribute('src')) return;
    items = groupOf(img);
    idx = Math.max(0, items.indexOf(img));
    box = (ui = build()).root; // 先建好骨架，再挂到 body 上
    prevOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden'; // 灯箱打开时锁住页面滚动
    doc.body.append(box);
    paint();
    ui.close.focus();
  }

  /** 关闭并清理浮层（可重复调用） */
  function close() {
    if (!box) return;
    ui.img.removeAttribute('src'); // 断开与宿主 objectURL 的引用
    box.remove();
    box = null; ui = null; items = []; idx = 0; // 复位，避免下次打开残留旧状态
    doc.body.style.overflow = prevOverflow;
  }

  /** 灯箱是模态：把按键全部吃掉，避免误触宿主的「数字键切模块」等快捷键 */
  function onKey(event) {
    if (!box) return;
    event.stopPropagation();
    const key = event.key;
    if (key === 'Escape') close();
    else if (key === 'ArrowLeft' || key === 'PageUp') go(-1);
    else if (key === 'ArrowRight' || key === 'PageDown' || key === ' ') go(1);
    else if (key === '+' || key === '=' || key === '-') zoomTo(key === '-' ? scale / 1.2 : scale * 1.2);
    else if (key === '0') zoomTo(MIN_SCALE);
    else return;
    event.preventDefault();
  }

  /** 事件委托：点中带 [data-wf-zoom] 的图片就打开灯箱 */
  function onClick(event) {
    if (box || event.button !== 0) return; // 已打开，或不是左键
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const img = event.target instanceof Element ? event.target.closest('img[data-wf-zoom]') : null;
    if (!img) return;
    event.preventDefault();
    open(img);
  }

  doc.addEventListener('click', onClick, true);
  window.addEventListener('keydown', onKey, true);

  // 首次启用时提示一次用法（标记落在插件私有存储里，随插件记录持久化）
  if (!api.storage.get('hinted', false)) {
    api.storage.set('hinted', true);
    api.toast('图库灯箱已就绪：点图片放大，← → 切换，Esc 关闭', 'info');
  }

  // 宿主停用 / 卸载插件时调用这个清理函数，保证页面上不留残余
  return () => {
    doc.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    close();
  };
}
