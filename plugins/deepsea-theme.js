/**
 * 插件：深海配色（两套完整配色方案）
 * ==================================================================
 * 在「设置 → 外观 → 插件配色」里提供两套配色，随明暗模式自动生效：
 *   · 深海 · 暗   —— 205° 深海蓝底 + 187° 青光主色
 *   · 羊皮纸 · 亮 —— 42° 羊皮纸底 + 28° 暖橙主色
 *
 * 为什么 19 个主题变量要给齐
 * ------------------------------------------------------------------
 * registerTheme 的 vars 是**整张作用域覆盖**：没给的变量会回落 index.css 的默认
 * 调色板（紫色主色系）。半套配色会出现「深海底色 + 紫色聚焦环」这种明显不搭，
 * 实测亮色 muted-foreground 对羊皮纸底只有 4.38（不达 WCAG AA 4.5），而它被用在
 * 269 处。补全到 19 个之后：muted-foreground 对底色 5.41，聚焦环跟着主色走。
 *
 * 2026-10-04 微调两处次要文字色（原先在浅色调面上不达 4.5 的最后两处来源）
 * ------------------------------------------------------------------
 *   · 亮 muted-foreground 42% → 38%：对 muted / secondary / accent 由 3.98~4.27 升到 4.64~4.97；
 *   · 暗 muted-foreground 64% → 66%：对 accent 由 4.41 升到 4.67。
 * 主色保持 45% 不动（审美优先）：亮色主色按钮上的白字 3.57 是全表唯一低于 4.5 的组合，
 * 已作为白名单写在 scripts/theme-cases.mjs，断言只要求它别再恶化。
 *
 * 11 个补全值的选值三原则（镜像 index.css 默认调色板里变量之间的关系）
 * ------------------------------------------------------------------
 *   1. --ring == --primary；各 *-foreground == --foreground；
 *   2. 亮色 --input == --border；暗色 --input 比 --border 亮 2 个明度点；
 *   3. 浮层比卡片亮一档；--destructive 保持红色（不改语义）。
 *
 * 升级提示（给已经装过旧版的人）
 * ------------------------------------------------------------------
 * 内置插件的源码是**首次启动时写进数据库**的，宿主不比对版本、不覆盖已有记录，
 * 所以改了这个文件，老用户看到的仍是旧源码。到插件页卸载「深海配色」，再点侧栏
 * 「恢复内置示例」里的「深海配色」即可装回新版。
 */
export const manifest = {
  id: 'builtin.deepsea',
  name: '深海配色',
  version: '0.2.0',
  author: 'WorldForge 内置示例',
  description: '提供「深海 · 暗」「羊皮纸 · 亮」两套完整配色（19 个主题变量），可在 设置 → 外观 中选用。',
};

export function activate(api) {
  api.registerTheme({
    id: 'deepsea-dark', name: '深海 · 暗', mode: 'dark',
    vars: {
      '--background': '205 45% 7%',
      '--foreground': '195 30% 92%',
      '--card': '205 42% 10%',
      '--card-foreground': '195 30% 92%',
      '--popover': '205 45% 12%',
      '--popover-foreground': '195 30% 92%',
      '--primary': '187 85% 53%',
      '--primary-foreground': '205 45% 8%',
      '--secondary': '205 32% 14%',
      '--secondary-foreground': '195 30% 92%',
      '--muted': '205 30% 16%',
      '--muted-foreground': '200 20% 66%',
      '--accent': '187 40% 20%',
      '--accent-foreground': '195 30% 92%',
      '--destructive': '0 55% 48%',
      '--destructive-foreground': '0 0% 98%',
      '--border': '205 30% 20%',
      '--input': '205 30% 22%',
      '--ring': '187 85% 53%',
    },
  });

  api.registerTheme({
    id: 'parchment-light', name: '羊皮纸 · 亮', mode: 'light',
    vars: {
      '--background': '42 45% 96%',
      '--foreground': '30 25% 15%',
      '--card': '42 50% 98%',
      '--card-foreground': '30 25% 15%',
      '--popover': '42 60% 99%',
      '--popover-foreground': '30 25% 15%',
      '--primary': '28 75% 45%',
      '--primary-foreground': '42 50% 98%',
      '--secondary': '40 35% 92%',
      '--secondary-foreground': '30 25% 15%',
      '--muted': '42 30% 90%',
      '--muted-foreground': '35 16% 38%',
      '--accent': '42 40% 88%',
      '--accent-foreground': '30 25% 15%',
      '--destructive': '0 65% 45%',
      '--destructive-foreground': '0 0% 98%',
      '--border': '38 25% 80%',
      '--input': '38 25% 80%',
      '--ring': '28 75% 45%',
    },
  });

  api.registerCommand({
    id: 'deepsea.hint',
    title: '配色插件：如何切换主题',
    hint: '插件',
    run: () => api.toast('到「设置 → 外观 → 配色方案」即可选用本插件提供的主题', 'info'),
  });

  // 主题是注册式插口：停用/卸载时由宿主按 pluginId 撤掉，这里没有需要手动清理的东西。
  return () => {};
}
