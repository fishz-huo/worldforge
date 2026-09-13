/**
 * 插件：文档导出（Markdown / 纯文本 / Word / PDF）
 * ==================================================================
 * 用法：插件面板里勾选「区域」与「格式」→ 开始导出。
 *   - 一个区域一份文件（需求：不同区域分别成文件，不合并）；
 *   - 桌面版选一次目录，所有文件写进去；网页版逐个下载（浏览器不给路径权限）；
 *   - PDF 走系统打印：「另存为 PDF」并自选保存位置。
 *
 * 分工：内容采集与排版在宿主侧（api.docExport，纯函数、可自测），插件只决定
 * 「导出哪些、什么格式、放哪里、出错怎么讲清楚」。
 *
 * PDF 为什么不由插件一口气全打印：每份 PDF 都要用户在打印对话框里选一次位置，
 * 而打印是异步的，连发会让上一份的预览被下一份覆盖。所以把待打印的 PDF 列出来，
 * 由用户逐份点击，节奏与结果都看得见。
 */
export const manifest = {
  id: 'builtin.exportdocs',
  name: '文档导出',
  version: '0.1.0',
  author: 'WorldForge 内置示例',
  description: '把卡片 Wiki、写作正文、笔记与大纲导出为 Markdown / 纯文本 / Word / PDF：可多选区域与格式，一个区域一份文件，保存位置自选。',
  settings: {
    splitItems: { type: 'boolean', label: '每个条目一个文件', default: false, hint: '默认一个区域一份文件；打开后每张卡片、每篇文稿各一份，装在同名子目录里' },
    branchOnly: { type: 'boolean', label: '只导出当前分支', default: false, hint: '平行世界视角下只导出主线内容与当前分支的内容' },
    includeRelations: { type: 'boolean', label: '卡片附带标签与关联', default: true, hint: '关闭后卡片条目只留字段与正文' },
  },
};

/** 格式：[显示名, 一句话说明]。PDF 的交互与其它三种不一样，必须提前讲清楚 */
const FORMAT_INFO = {
  md: ['Markdown', '保留标记，可原样回灌'],
  txt: ['纯文本', '去掉标记，记事本也能看'],
  docx: ['Word 文档', '排版接近预览，可用 Word / WPS 继续编辑'],
  pdf: ['PDF', '弹出系统打印窗口，选「另存为 PDF」并挑位置'],
};
const FORMAT_IDS = ['md', 'txt', 'docx', 'pdf'];

/** 最近一次构建的结果，停用插件时清掉 */
let lastBuild = [];

export function activate(api) {
  const { React } = api.ui;
  const h = React.createElement;
  const { useState } = React;

  /** 读插件设置：api.settings 是访问器，用户改完立即生效 */
  const opt = (key, fallback) => (api.settings[key] === undefined ? fallback : api.settings[key]);

  /** 有内容的区域：空区域不默认勾选，也不会生成空文件 */
  const filledAreas = () => api.docExport.areas().filter((a) => a.count > 0).map((a) => a.id);

  /** 导出请求：面板与命令面板共用同一套选项 */
  const makeRequest = (ids, formats) => ({
    areaIds: ids, formats,
    split: opt('splitItems', false),
    branchOnly: opt('branchOnly', false),
    includeRelations: opt('includeRelations', true),
  });

  /**
   * 核心流程：构建文件 → 写盘（md/txt/docx）→ 把 PDF 留给用户逐份打印。
   * 返回 { saved, pdfs, canceled }；canceled 表示用户在选择目录时取消了。
   */
  async function buildAndSave(request) {
    const files = await api.docExport.build(request);
    if (files.length === 0) return api.toast('选中的区域里没有内容可导出', 'warn'), null;
    lastBuild = files;
    const docs = files.filter((f) => f.format !== 'pdf');
    const pdfs = files.filter((f) => f.format === 'pdf');
    if (docs.length === 0) return { saved: null, pdfs, canceled: false };
    // 桌面版先选一次目录（记住上次位置）；网页版没有目录权限，走浏览器下载
    let dir = api.storage.get('lastDir', '');
    if (api.files.canPickDirectory()) {
      const picked = await api.files.pickDirectory(dir || undefined);
      if (!picked) return api.toast('没有选择导出目录，已取消', 'info'), { saved: null, pdfs, canceled: true };
      dir = picked;
      api.storage.set('lastDir', dir);
    }
    const report = await api.files.writeFiles(
      docs.map((f) => ({ name: f.name, subDir: f.subDir, text: f.text, bytes: f.bytes, mime: f.mime })),
      dir || null,
    );
    if (report.errors.length > 0) api.toast(`导出出错：${report.errors[0]}`, 'error');
    else if (report.mode === 'desktop') api.toast(`已写出 ${report.written.length} 个文件到 ${report.dir}`, 'success');
    else api.toast(`网页版没有目录权限，已触发 ${report.written.length} 个下载`, 'info');
    return { saved: report, pdfs, canceled: false };
  }

  /** 命令面板快捷入口：全部区域导出成 Markdown（选项沿用插件设置） */
  api.registerCommand({
    id: 'exportdocs.quick',
    title: '快速导出：全部区域为 Markdown',
    hint: '文档导出',
    run: () => buildAndSave(makeRequest(filledAreas(), ['md'])),
  });

  api.registerPanel({
    id: 'exportdocs.panel',
    title: '文档导出',
    icon: 'FileOutput',
    render: () => {
      // 区域摘要只在挂载时算一次（大世界观下每次渲染都统计一遍会卡）；数据变了点「刷新」
      const [areas, setAreas] = useState(() => api.docExport.areas());
      const [picked, setPicked] = useState(() => filledAreas());
      const [formats, setFormats] = useState(['md']);
      const [busy, setBusy] = useState(false);
      const [log, setLog] = useState([]);
      const [pending, setPending] = useState([]);

      /** 勾选 / 取消勾选一个值 */
      const toggle = (list, apply, value) =>
        apply(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

      /** 一行复选框：标题 + 说明，禁用时整行变淡 */
      const checkRow = (key, checked, disabled, label, note, onChange) =>
        h('label', { key, className: `flex items-start gap-2 rounded border border-border px-2 py-1.5 text-xs ${disabled ? 'opacity-40' : 'cursor-pointer hover:bg-accent'}` },
          h('input', { type: 'checkbox', checked, disabled, className: 'mt-0.5 size-3 accent-primary', onChange: (e) => onChange(e.target.checked) }),
          h('span', { className: 'min-w-0 flex-1' },
            h('span', { className: 'block font-medium' }, label),
            h('span', { className: 'block text-muted-foreground' }, note)));

      const button = (label, onClick, disabled) =>
        h('button', { onClick, disabled, className: 'rounded border border-border bg-muted px-2 py-1 text-xs hover:bg-accent disabled:opacity-50' }, label);

      const startExport = async () => {
        if (picked.length === 0) return api.toast('请至少选一个区域', 'warn');
        if (formats.length === 0) return api.toast('请至少选一种格式', 'warn');
        setBusy(true);
        setLog([]);
        try {
          const result = await buildAndSave(makeRequest(picked, formats));
          if (!result) return;
          const lines = [...result.saved?.written ?? []];
          if (result.saved?.mode === 'download') lines.push(`（${result.saved.written.length} 个文件已交给浏览器下载）`);
          result.pdfs.forEach((p) => lines.push(`待打印：${p.name}`));
          setLog([...lines, `本次共构建 ${lastBuild.length} 个文件`]);
          setPending(result.pdfs);
        } catch (err) {
          api.toast(`导出失败：${err && err.message ? err.message : err}`, 'error');
        } finally {
          setBusy(false);
        }
      };

      return h('div', { className: 'space-y-3 p-1' },
        h('div', { className: 'text-xs text-muted-foreground' },
          '选区域与格式，导出成「一个区域一份文件」。',
          api.files.canPickDirectory() ? '' : '网页版无法选择保存目录，文件会逐个下载到浏览器的下载目录。'),

        h('div', { className: 'space-y-1' },
          h('div', { className: 'flex items-center justify-between text-xs font-medium' },
            h('span', null, '导出区域'),
            button('刷新', () => { setAreas(api.docExport.areas()); setPicked(filledAreas()); })),
          ...areas.map((a) => checkRow(
            a.id, picked.includes(a.id), a.count === 0,
            `${a.title}（${a.count} 条 · ${a.words} 字）`,
            a.count === 0 ? '这个区域还没有内容' : a.hint,
            () => toggle(picked, setPicked, a.id)))),

        h('div', { className: 'space-y-1' },
          h('div', { className: 'text-xs font-medium' }, '导出格式'),
          ...FORMAT_IDS.map((f) => checkRow(
            f, formats.includes(f), false, FORMAT_INFO[f][0], FORMAT_INFO[f][1],
            () => toggle(formats, setFormats, f)))),

        h('div', { className: 'space-y-1' },
          h('div', { className: 'text-xs font-medium' }, '导出选项'),
          checkRow('split', opt('splitItems', false), false, '每个条目一个文件', '卡片/文稿各一份，装在同名子目录里',
            (v) => api.setSetting('splitItems', v)),
          checkRow('branch', opt('branchOnly', false), false, '只导出当前分支', '平行世界视角下只导主线与当前分支',
            (v) => api.setSetting('branchOnly', v)),
          checkRow('rel', opt('includeRelations', true), false, '卡片附带标签与关联', '关掉后卡片条目只留字段与正文',
            (v) => api.setSetting('includeRelations', v))),

        h('div', { className: 'flex items-center gap-2' },
          button(busy ? '正在导出…' : '开始导出', startExport, busy),
          button('清空记录', () => { setLog([]); setPending([]); }, busy)),

        log.length > 0 && h('div', { className: 'max-h-40 space-y-0.5 overflow-y-auto rounded border border-border bg-muted/30 p-2 font-mono text-[10px] text-muted-foreground' },
          ...log.map((line, i) => h('div', { key: i, className: 'break-all' }, line))),

        pending.length > 0 && h('div', { className: 'space-y-1 rounded border border-border p-2' },
          h('div', { className: 'text-xs font-medium' }, `PDF：${pending.length} 份待打印`),
          h('div', { className: 'text-[10px] text-muted-foreground' }, '逐份点击；打印对话框里选「另存为 PDF」并挑保存位置。'),
          ...pending.map((file, i) => h('div', { key: i, className: 'flex items-center gap-2' },
            h('span', { className: 'min-w-0 flex-1 truncate text-[11px]' }, file.name),
            button('打印这一份', async () => {
              const outcome = await api.files.printDocument(file.html, file.name);
              if (!outcome.ok) api.toast(`打印失败：${outcome.error}`, 'error');
              // 按文件名移除，不用下标：列表重渲染后下标会变
              else setPending((list) => list.filter((f) => f.name !== file.name));
            })))));
    },
  });

  // 停用/卸载时清掉构建缓存；页面上没有全局监听需要摘除（打印容器由宿主回收）
  return () => { lastBuild = []; };
}
