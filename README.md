# WorldForge 世界观工坊

> **版本：v0.1（需求规划版）**
> 轻量 Wiki + 零切换写作 —— 本地优先（Local-First）的世界观创作管理软件

WorldForge 用来专门构筑作品的世界观与角色故事。它比 World Anvil 轻量、比 Obsidian 更结构化：
用**卡片**管理角色 / 地点 / 事件 / 底层逻辑 / 参考资料，用**地图**表达方位与资源分布，
用**时间轴**串起事件、角色年龄与文明演进，并在同一个界面里把正文写下去——
写到哪，相关设定卡就跟到哪，鼠标悬停关键词即可预览。

所有数据保存在你自己的机器上：**不联网、不上传、不需要账号**。

---

## 快速开始

> 包管理器：**npm**（仓库只带 `package-lock.json`）。请勿混用 pnpm / yarn，
> 否则 `node_modules` 的链接结构会被推平重装。
>
> `package.json` 里的 `"allowScripts": { "esbuild": true }` 是 npm 11 的构建脚本审批白名单：
> esbuild 需要执行 `postinstall` 准备平台原生二进制，Vite 的构建与开发服务器都依赖它。
> 因为已显式批准，`npm install` 时那条 `allow-scripts` 警告不会再出现；换机器也不需要重新批准。

```bash
npm install           # 安装依赖
npm run dev           # 开发服务器（默认 http://localhost:5173）
npm run build         # 类型检查 + 生产构建 → dist/
npm run preview       # 预览生产构建
npm test              # 运行 346 项自测（16 个套件，Node 环境，无需浏览器）
npm run test:sample   # 由测试世界观手册重新生成 samples/ 里的可导入备份并校验
npm run test:backup   # 导出 / 导入回归自测（含损坏备份的回滚验证）
npm run test:export   # 文档导出（Markdown / 文本 / Word / PDF）的采集、排版与文件清单自测
npm run test:mobile   # 移动端能力边界（桌面 / 移动壳的判定与「不许假装成功」）
npm run icons         # 重新生成 PWA / Tauri 图标（零依赖脚本）
```

打包为桌面应用（需要 Rust 工具链）：

```bash
npm run tauri:dev     # 桌面端开发
npm run tauri:build   # Windows 安装包（NSIS + MSI）→ src-tauri/target/release/bundle/
```

### 手机上怎么用（两条路，按上手速度排）

| 路线 | 怎么走 | 代价 / 限制 |
| --- | --- | --- |
| **A. 局域网直接开**（2 分钟） | 电脑上 `npm run build` 然后 `npm run preview -- --host`；手机连同一个 Wi-Fi，浏览器打开 `http://<电脑的局域网 IP>:4173/` | 电脑要一直开着、命令要保持运行；因为是 `http://` 而非 HTTPS，浏览器**不会注册 Service Worker** → 没有离线能力，也不会出现「安装应用」，只能「添加到主屏幕」 |
| **B. 部署到 HTTPS 静态站** | 把 `dist/` 传到任意 HTTPS 静态托管（Cloudflare Pages / GitHub Pages / 自建），手机打开网址 → 出现真正的「安装应用」，装完可离线 | 需要一处静态托管；软件本体在公网（**数据不上传**，只存手机本地） |

**两条路共同的坑：数据各存各的。** 本软件是本地优先、无账号、无云同步 ——
「多端运行」指的是同一份前端代码能跑在多个平台，**不是数据自动同步**：
手机上的世界观与电脑上的完全独立。搬运方法：电脑「设置 → 数据 → 导出完整备份（含图片）」
→ 传到手机（微信 / 网盘 / USB）→ 手机「设置 → 数据 → 导入」。

> 手机上请养成导出备份的习惯：浏览器的站点数据可能被系统回收，
> iOS 的 Safari 还会清掉长期不用的网站数据。
>
> 移动端与桌面端的能力差异（选目录、直接写盘在手机上都不可用）见
> `src/lib/save-open.ts` 的 `isMobileShell()`，由 `scripts/mobile-selftest.mjs` 守着：
> 走不通的路一律**明确报错**，不会假装成功。
> 鸿蒙用同一套浏览器承载（ArkWeb）。
>
> **没有提供 Android APK 打包**：Tauri 的 Android 工具链在国内网络下需要
> Gradle 与 Android SDK 共约 6 GB 下载，且官方下载器无超时无续传、极易假死。
> 实测走通成本过高，已放弃该路线；要离线用请走上面两条路（B 装完即是真离线）。

首次启动会写入一个**示例世界观「灰烬纪元」**（含 8 张卡片、5 条泳道、12 个时间轴条目、
1 张地图、2 个资源区域、正文与大纲各一篇），可以直接在它上面改，也可以一键重建或清空
（设置 → 数据 → 危险操作）。

> 第一次使用建议对着 [`docs/使用说明.md`](docs/使用说明.md) 走一遍：那里按「点哪个按钮 →
> 出现什么界面 → 选什么选项」写清了每个功能怎么用。
>
> 想把每个功能都喂上真实数据，用 [`docs/猫猫的冒险·世界观设定.txt`](docs/猫猫的冒险·世界观设定.txt)：
> 那是一套完整的测试世界观（48 张卡片 / 7 个标签 / 16 条关联 / 2 张地图 / 5 条泳道 / 3 条平行世界分支），
> 可以照着文本手动录入，也可以直接导入 `samples/猫猫的冒险.worldforge.json`（同内容、机器可读）。

---

## 14 条需求与实现对照

| # | 需求 | 实现位置 | 说明 |
| --- | --- | --- | --- |
| 1 | 卡片式管理 + 信息互相关联、关系自由填写 | `src/features/cards/` | 9 种内置类型 + 插件可扩展；`relations` 表的 `label` 完全自由填写（如「师父」「导致」），支持双向反查与卡片详情页 `[[标题]]` 双链 |
| 2 | 可视化地图编辑器（方位、资源、政区、多张地图） | `src/features/map/` | 底图 + 归一化标记点 + 可拖顶点多边形区域；人口/农业/矿产/军力/商贸资源条与「资源热度」着色；一张地图 = 一个时期，跨地图做时期对比 |
| 3 | 可视化时间轴（时长、年龄、状态、地理与科技变化） | `src/features/timeline/` | 泳道分事件/角色生命线/地理变化/科技水平/底层设定；拖动游标即得「该时刻各角色年龄 + 状态 + 正在发生的事件」；数值型泳道画折线；条目可挂地图 |
| 4 | 世界观底层逻辑写作区 | 卡片类型 `lore` + 总览「底层逻辑」区 | 类别（魔法/修炼/神系/关键物质/世界规则/科技树…）、核心规则、代价限制、对世界的影响、演变趋势 |
| 5 | 插入图片 | `src/features/cards/CardGallery.tsx` + `plugins/gallery-lightbox.js` | 元数据入 SQLite、二进制入 IndexedDB；一张卡片多张图、可设封面；正文里可直接粘贴/拖入图片（`asset:` 引用）；点图库任意一张图即全屏放大，可左右切换、键盘翻页、滚轮缩放 |
| 6 | 界面简约可隐藏、操作符合直觉、尽量可视化又保留纯文本 | `src/components/layout/` | 三栏（导航 / 侧栏 / 检查器）均可一键显隐 + 专注模式；Ctrl+K 命令面板；31 个键盘快捷键；可视化视图与 Markdown 文本视图随处可切 |
| 7 | 多端运行（Windows / 安卓 / 鸿蒙 / iOS） | `src-tauri/` + `public/manifest.webmanifest` | 同一份前端代码：Tauri 2 打包桌面与移动，PWA 覆盖其余平台；响应式布局在手机上把侧栏变为抽屉、导航变为底部标签栏 |
| 8 | 平行世界设定 | `src/components/layout/WorldSwitcher.tsx` + `src/store/slices/dataSlice.ts` | 一个世界观下多条世界线；主世界卡片在所有分支可见，分支可「派生」出独立副本；可记录分歧点与分歧刻度；顶栏可切「全部分支」总览 |
| 9 | 参考资料区与关联 | 卡片类型 `reference` + 关联 | 资料类型/作者/链接/年份/关键摘录/可借鉴点；通过关联挂到任意角色、事件或设定上，卡片检查器反查「谁引用了我」 |
| 10 | 故事大纲区（可切树形） | `src/features/outline/` | 与写作层同一套 Markdown 编辑器；**文本 / 树形 / 思维导图**三视图共享同一份数据，可双向转换（按标题重建树、把树写回文本），节点可挂卡片、切状态、升降层级 |
| 11 | tag 系统与筛选 | `src/features/cards/TagPicker.tsx` | 标签自由输入即建；多标签 AND 筛选；颜色可改；卡片列表/悬浮预览/时间轴处处可见 |
| 12 | 设定版本切换对比 | `src/features/versions/` + `src/lib/snapshot-diff.ts` | 一键存快照；随时与当前设定做**结构化**对比（新增/删除/修改的卡片、字段级变化、文稿行级 diff）；可整体还原、可导出单个快照 |
| 13 | 小巧不臃肿、构建快 | 见下方「体积」 | 无富文本编辑器、无图表库、无 UI 框架依赖；Markdown 解析器、diff、OOXML + ZIP 写入器均为自研；生产构建约 20 秒 |
| 14 | 插件区与插件插口 | `src/features/plugins/` + `src/lib/plugin/` | 7 类插口（卡片类型、追加字段、面板、命令、卡片动作、主题、导出器）+ 事件订阅 + 只读查询 + 私有存储 + **写盘 / 打印 / 文档导出**（`api.files`、`api.docExport`）；附 5 个可读可改的内置插件：「图库灯箱」演示不新增面板、直接给已有界面加交互，「文档导出」演示多区域多格式导出与系统「另存为 PDF」 |

---

## 技术栈与体积

React 18 + Vite 6 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui(Radix) + sql.js(SQLite WASM)
+ IndexedDB + Tauri 2 + PWA。

生产构建产物（`npm run build`）：

| 资源 | 原始 | gzip |
| --- | --- | --- |
| `index.js`（业务代码，含内置插件源码与文档导出） | 411 KB | 121 KB |
| `vendor-react` | 166 KB | 55 KB |
| `vendor-radix` | 112 KB | 35 KB |
| `vendor-sqljs` | 40 KB | 15 KB |
| `index.css`（含打印成 PDF 的排版样式） | 45 KB | 9 KB |
| 两个入口小分块 | 4 KB | 1 KB |
| `sql-wasm.wasm`（按需加载） | 658 KB | 323 KB |
| **合计（含按需加载的 wasm）** | **≈ 1.44 MB** | **≈ 559 KB** |

> 只算首屏必需的 JS + CSS 是 **≈ 0.78 MB / ≈ 236 KB（gzip）**；
> SQLite 的 wasm 在初始化数据库时才拉取。表里的数字用 `gzip` 实测，
> 与打包器打印的 kB（十进制）略有差异。
>
> 文档导出（Markdown / 纯文本 / HTML / Word 的排版与 OOXML + ZIP 写入）全部是自研的，
> 没有引入 jsPDF / docx / exceljs 之类的库 —— 换来的是 `index.js` 比上一版大约 60 KB，
> 以及 PDF 交给系统打印引擎（中文字体与分页才靠得住）。

刻意**没有**引入的重量级依赖：TipTap/ProseMirror（自研 Markdown 编辑器）、ECharts/Recharts
（地图、时间轴、思维导图、资源图全部手绘 SVG/DOM）、MUI/AntD、idb/dexie（自写 IndexedDB 封装）、
marked/markdown-it（自研解析器，顺便把 `[[双链]]` 与关键词自动关联做进解析流程）。

---

## 目录结构

```
src/
├── types/          领域类型：卡片字段字典、地图、时间轴、文稿、插件 API、导出契约
│   └── timeline.ts / card-types.ts / plugin-api.ts …
├── lib/
│   ├── db/         schema（分两部分）· sqlite 引擎 · init 初始化与迁移 · IndexedDB 封装
│   │               表描述驱动的通用仓储 · 级联删除 · 保存状态
│   ├── markdown/   自研 Markdown 解析（块级 / 行内 / 双链 / 自动关联 / 统计）
│   ├── plugin/     插件注册表、宿主 API、事件总线、内置示例插件
│   ├── export/     文档导出：区域采集、Markdown / 纯文本 / 打印 HTML、Word（OOXML + ZIP）
│   ├── seed/       示例世界观数据（cards 设定层 / world 场景层）
│   └── …           diff、快照、快照差异、查询、大纲文本转换、素材、备份、写盘与打印、ID、工具
├── store/          zustand：ui / data / world / card / tag / map / timeline / doc /
│                   outline / version / plugin 十二个 slice
├── components/
│   ├── ui/         shadcn/ui 风格基础组件（button、dialog、tabs、select…）
│   ├── layout/     应用骨架、顶栏、图标导航、面板外壳、状态栏、命令面板
│   └── common/     Markdown 编辑器 / 工具条 / 双链选择器 / 渲染视图 / 自动保存控件
├── features/       board、cards、map、timeline、writer、outline、versions、plugins、settings
└── hooks/          资源 URL、插件注册表订阅、快捷键、去抖

docs/               需求规格说明书、架构设计、数据模型、插件开发指南、使用说明、
                    测试世界观手册（猫猫的冒险 · 纯文本，可直接照抄录入）
samples/            由手册生成的测试数据备份（可用「设置 → 数据 → 导入设定」直接导入）
plugins/            以独立 .js 文件发布的插件源码（内置「图库灯箱」「文档导出」就在这里，可单独分享）
scripts/            图标生成 + 15 个自测套件（运行器、解析钩子、假 IndexedDB、selector / 表描述 / 插件 / 导出静态检查器，均零依赖）
src-tauri/          Tauri 2 壳（Cargo 配置、权限清单、入口）
public/             PWA manifest、Service Worker、图标
```

代码规范：**每个文件不超过 200 行**，注释说明「为什么这么做」而不只是「做了什么」。

---

## 数据与隐私

- 三层存储：**sql.js 内存 SQLite** → 去抖 800ms 导出二进制快照 → **IndexedDB**（`kv` 仓库）；
  图片二进制单独存 IndexedDB 的 `assets` 仓库，SQLite 里只留元数据。
- 页面隐藏 / 关闭前强制落盘（`visibilitychange` + `pagehide` + `beforeunload`），状态栏实时显示保存状态。
- 可在「设置 → 数据」申请**持久化存储**授权，避免浏览器在空间紧张时清理数据。
- 导出：设定 JSON / 含图片的完整备份 / 原始 `.sqlite` 文件；导入会覆盖当前世界观内容（图片按 id 合并）。
- 另有一条**通用格式**出口：内置插件「文档导出」把卡片 Wiki / 写作正文 / 笔记 / 大纲导成
  Markdown / 纯文本 / Word / PDF（一个区域一份文件、保存位置自选），交给别的软件看或打印；
  PDF 走系统打印，中文字体与分页都由系统排版引擎负责。

---

## 质量验证

```bash
npm run typecheck   # TypeScript 严格模式，0 错误
npm test            # 346 项自测（16 个套件，全部跑在 Node 里，不需要浏览器）
```

| 套件 | 项数 | 覆盖内容 |
| --- | --- | --- |
| `scripts/selftest.mjs` | 12 | Markdown 解析、HTML 转义防注入、外链协议白名单、`[[双链]]`、关键词自动关联（含不污染代码块）、行级 diff、超长文本退化路径、快照结构 diff |
| `scripts/selftest-model.mjs` | 14 | 分支可见性、标签 AND 筛选、标题索引与长标题优先、关联双向反查、大纲文本 ⇄ 树、时间轴刻度与年龄推算、示例数据自洽性 |
| `scripts/selftest-source.mjs` | 28 | **zustand selector 静态检查**（禁止在 selector 里 `.filter()` 等产生新引用的写法）+ **源码行数检查**（每文件 ≤ 200 行）+ **Radix 面板检查**（`TabsContent` 上禁止 display 类，否则 `hidden` 失效、未激活面板仍占高度）+ **禁止原生 `confirm/alert/prompt`**；每项检查都以可证伪样本验证过有效性 |
| `scripts/selftest-specs.mjs` | 12 | **表描述 ↔ 领域类型一致性**（通用仓储用列名当属性名，字段名写错会静默失效）+ **插件 API 文档与源码一致**（指南里那行 `worldforge:plugin-api` 清单与 `PluginAPI` 强制比对） |
| `scripts/plugin-selftest.mjs` | 12 | **插件源码检查**（幽灵 API、`import`、全局监听未移除、声明了却没人读的设置项、缺 `activate`/清理函数）+ **宿主 DOM 契约防漂移**（插件依赖的每个 `data-wf-*` 必须在宿主源码里真实存在）+ **内置清单接线**（`?raw` 引用的文件、manifest id 一致）+ **面板必须当组件渲染**（直接调用 `render()` 会让插件 hooks 串进宿主 → React #310）+ **`api.settings` 实时性**（行为测试：改完设置立刻读到新值） |
| `scripts/confirm-selftest.mjs` | 9 | **确认对话框接线**：注册宿主后原样透传请求并返回用户选择；宿主未挂载时返回 false 且**绝不回退到 `window.confirm`**（那正是桌面版报错的来源）；重复注册以最后一次为准 |
| `scripts/export-selftest.mjs` | 14 | **导出采集**（四个区域的条目/字段/标签/关联、类型排序、分支过滤默认关、大纲优先用节点树、空区域不生成文件）+ **Markdown 与纯文本**（正文原样保留、标记去除但不漏字、目录阈值、文件名清洗）—— 同时跑合成数据与真实示例世界观两份数据 |
| `scripts/export-html-test.mjs` | 11 | **打印用 HTML（PDF 出口）**：抬头/条目、标题降级且不超 h6、转义防注入、图库图片换文字说明、按章节分页标记 + **文件清单**：一区一文件不合并、命名带世界观与时间戳、PDF 只给 HTML、拆分模式带子目录与序号 |
| `scripts/export-zip-test.mjs` | 5 | **手写 ZIP 写入器**：CRC32 已知向量、自写解析器读回条目、deflate 往返、压缩无收益时退回存储、头部字段合法性（版本 / DOS 时间范围） |
| `scripts/export-docx-test.mjs` | 11 | **Markdown → 文档块 → OOXML**：行内片段（粗体/斜体/代码/双链/转义/不成对标记）、段落与列表与表格、7 个部件齐全、XML 转义、样式与页面设置、真实样例可被外部解压校验 |
| `scripts/mobile-selftest.mjs` | 7 | **移动端能力边界**：桌面壳 / Android 壳 / iOS 壳 / 手机浏览器四种环境的判定；**移动端写文件必须明确报错而不是假装成功**；静态守住 Rust 的 `print_window` 有桌面与移动两份实现（桌面版才允许 `.print()`）、前端打印分支排除移动端 |
| `scripts/sample-check.mjs` | 135 | **测试世界观数据自测**：手册里的字段名与 `card-types.ts` 的 FieldDef 逐个对照、下拉取值必须在 options 内、id 引用与坐标刻度约束、手册声明的数量必须等于实际数量、**把生成的备份喂给真实 `importBackup()` 走一遍事务写库再读回核对**、手册指纹比对（改了手册忘记重新生成会直接报错） |
| `scripts/db-selftest.mjs` | 13 | 建表 DDL（19 张表）、首次播种、落盘到 IndexedDB、卡片/标签/关联/地图/区域 CRUD、图库封面引用清理与装载自愈、插件记录字段完整性与往返 |
| `scripts/db-selftest-scene.mjs` | 10 | 时间轴条目（含瞬时事件判定、从卡片生成）、大纲树重建与回写、平行世界派生与清理 |
| `scripts/db-selftest-persist.mjs` | 6 | 版本快照 → 改动 → 还原、关闭应用后重新开库读回数据、级联删除不留孤儿数据 |
| `scripts/backup-selftest.mjs` | 47 | **导出 / 导入回归**：导出 → 新建空世界观 → 导入（数量必须一致）、**导入不得搬走来源世界的数据**（id 重映射）、同文件导两次不重复、导回原世界不变、预检挡住 5 类损坏备份、**故意让写库失败并验证整体回滚**、**图库图片往返（含旧备份缺 cardAssets 的兼容路径）**、错误提示必须是人话 |

前 11 个套件是纯逻辑与静态检查（其中 4 个专测文档导出、1 个专测移动端边界），后 5 个套件使用**真实 sql.js**（SQLite WASM）+ 内存版
IndexedDB（`scripts/fake-idb.mjs`），通过模块解析钩子（`scripts/alias-hook.mjs`）
把 `@/` 别名与 Vite 的 `?url` / `?raw` 资源导入补齐，
因此无需浏览器即可端到端验证数据层、内置插件源码的装载路径，以及导入备份的完整流程。

> 这些脚本在开发中抓到了真实缺陷。一例：版本还原时 `saveMany` 与外层事务嵌套，
> 触发 SQLite `cannot start a transaction within a transaction`，
> 导致「清空了但没写回」（修复方式：可重入事务，见 `docs/数据模型.md` §6.1）。
>
> 另三例出在**数据进出**上，都是用户实测发现的，现在由
> `scripts/backup-selftest.mjs` 与 `scripts/confirm-selftest.mjs` 守住：
> 1. **没有改写 `world_id`** —— 导出文件里带着来源世界的 id，导入到另一个世界观时
>    所有行仍属于来源世界，界面上一片空白，而确认框已经把当前世界观清空了。
>    修复：写库前统一改写归属，并在事务里按世界观统计行数自校验。
> 2. **复用了同一批 id** —— 主键全局唯一，导入一份「自己导出的」备份会把原世界观的行
>    直接改成新世界观的归属，表现为「导入之后原世界观被搬空了」。
>    修复：导入前为所有实体生成新 id 并同步改写跨表引用（`backup-remap.ts`），
>    导入是**复制**而不是搬移。
> 3. **快照漏掉了卡片图库关联** —— `buildSnapshot()` 从一开始就没把 `card_assets`
>    放进快照，于是「导出完整备份再导入」以及「版本还原」之后，图片元数据与二进制都在、
>    图库里却是空的（界面显示「图片已丢失」），而同一份备份里的文本数据完好 ——
>    这正是用户描述的现象。修复：快照与还原都带上 `cardAssets`，
>    并对旧备份做兼容（缺这一段时补空数组，导入前在确认框里提醒）。
>
> 这三个缺陷共同说明一件事：数据相关的操作必须有「失败要吵、成功要验」的测试，
> 所以现在的导入是「预检 → 事务 → 行数自校验 → 出错整体回滚」。
>
> 还有一例是**桌面端专属**的：Tauri 会把 `window.confirm` 转发给 dialog 插件，
> 未放开权限时抛「dialog.confirm not allowed. Command not found」，
> 于是桌面版所有删除/清空操作全部失效。修复：14 处调用统一改为应用内对话框
> （`lib/confirm.ts` + `components/layout/ConfirmHost.tsx`），
> 并由 `scripts/selftest-source.mjs` 静态禁止源码里再出现原生 `confirm/alert/prompt`。
>
> 写「文档导出」时，新加的 4 个导出套件当场抓到两处自己写错的地方，都在提交前修掉：
> 1. **分支过滤把参数忘了** —— `inBranch()` 忘了看 `opts.branchOnly`，
>    于是不管用户勾没勾「只导出当前分支」，别的平行世界分支的内容都会被默默丢掉。
>    这正是导出类功能最危险的失败方式：文件生成了、看着也对，只是内容少了一部分。
>    修复后由 `export-selftest.mjs` 用「默认全都导」与「勾了才过滤」两条断言夹住。
> 2. **标题降级只改了开标签** —— 把正文标题从 `h1` 降到 `h3` 时只替换了 `<h1>`，
>    留下 `<h3>…</h5>` 这种错配。浏览器会自行纠正，PDF 与 Word 转换器未必。
>    修复：开闭标签一起改，并补上 `shiftHeadings('<h1>a</h1>') === '<h3>a</h3>'` 的断言。
>
> 第三例是**宿主与插件之间的 hooks 契约**，靠真实浏览器冒烟验证才抓到：
> `PluginPanelHost` 过去是直接调用 `active.render()`。函数式调用意味着插件的 `useState`
> 会挂到宿主组件的 hook 链表上 —— 于是「面板从无到有」（插件在启动后才激活）或
> 「切到 hooks 数量不同的面板」时 hooks 数量发生变化，React 抛 `error #310`，
> 整个插件模块变成「渲染出错」页。修复：把面板**当组件**渲染
> （`<ActivePanelHost render={...} />`，并按面板 id 给 `key`），
> 同时由 `scripts/plugin-selftest.mjs` 静态禁止再写回直接调用 `render()`。
> 这一例顺带说明两件事：单元测试看不见 hook 链表，**必须真的在浏览器里跑一遍**；
> 而 PWA 的 Service Worker 会缓存旧产物 —— 第一次「改完仍报错」就是因为在验证旧 bundle，
> 所以冒烟脚本先注销 SW 并清空 cache，再断言页面上加载的 chunk 哈希。
>
> 第四例**只在 Android 上才暴露**：`WebviewWindow::print()` 挂在 Tauri 的 `#[cfg(desktop)]`
> impl 块里，桌面端 `cargo check` 一路绿灯，`tauri android build` 却直接以
> `error[E0599]: no method named print` 编译失败 —— 桌面上的 typecheck / build / npm test
> 一个都看不见它。修复：Rust 侧按平台写两份 `print_window`（桌面用 `webview.print()`，
> 移动端如实报错），前端改成「桌面壳且**不是**移动壳」才走 Rust 命令，否则用页面里的
> `window.print()`（Tauri 文档写明它在所有平台可用）；并由新增的
> `scripts/mobile-selftest.mjs` 静态守住这两处，避免再改回去。
> 顺带把导出插件在手机上的行为改诚实了：写文件这条路在移动端走不通时**明确报错**，
> 不再静默什么都不做。
> （这段移动端适配代码保留着 —— 它让代码能编译、行为诚实，桌面端完全不受影响；
> 只是**打包 APK 这条路已放弃**，见上面「手机上怎么用」。）

代码规范自查：审计范围内共 **220 个源文件，没有任何文件超过 200 行**（`README`/文档/样式表除外），
该规则由 `scripts/selftest-source.mjs` 自动校验，不依赖人工统计。

> ⚠️ 统计行数时不要用 PowerShell 的 `Get-Content` / `Measure-Object -Line`：
> PS 5.1 读取无 BOM 的 UTF-8 文件会按 ANSI 解码，中文注释多的文件行数会**偏少**
> （实测：91 行被算成 84 行、195 行被算成 187 行）。
> 正是这个偏差让一个 201 行的文件从「≤ 200 行」的人工审计中漏了过去，
> 所以现在改由上面的测试用 Node 按换行符精确统计。

---

## v0.1 的边界（明确不做）

- 地图不做精细边界绘制与 GIS 投影，只做归一化标记与粗略多边形；
- 不做云同步、账号、多人协作；
- 插件无沙箱，属于**可信任模型**：请只载入自己写的或完全信任来源的插件；
- 版本快照不含图片二进制，也不支持分支级 diff 的自动合并；
- 时间轴使用数值刻度而非真实历法换算（用「刻度单位 + 年龄换算系数」近似表达）。

## 文档

| 文档 | 内容 |
| --- | --- |
| [`docs/使用说明.md`](docs/使用说明.md) | **用户手册**：逐功能的分步操作（点哪个按钮 → 出现什么界面 → 选什么选项），含界面总览、快捷键、每个模块的完整流程、常见问题与已知边界 |
| [`docs/猫猫的冒险·世界观设定.txt`](docs/猫猫的冒险·世界观设定.txt) | **测试世界观手册**（纯文本）：一整套「猫猫的冒险」设定，按 9 种卡片 / 标签 / 关联 / 地图 / 时间轴 / 文稿 / 大纲逐项列好，可照抄录入；由它生成的 `samples/猫猫的冒险.worldforge.json` 可直接导入 |
| [`docs/需求规格说明书-v0.1.md`](docs/需求规格说明书-v0.1.md) | FR-01~FR-14 详述：用户故事、交互流程、数据落点、验收清单、范围边界、路线图、风险 |
| [`docs/架构设计.md`](docs/架构设计.md) | 分层架构、目录职责、九大关键机制、性能与体积预算、代码规范 |
| [`docs/数据模型.md`](docs/数据模型.md) | 19 张表字段级定义、ER 图、卡片字段字典、典型 SQL、事务可重入要点、迁移策略 |
| [`docs/插件开发指南.md`](docs/插件开发指南.md) | PluginAPI 逐方法说明、事件与设置 schema、宿主 DOM 契约、发布与分享；§3.4「图库灯箱」与 §4.4「写盘 / 打印 / 文档导出」的代码就是仓库里的 `plugins/*.js`，与实现逐字一致 |
