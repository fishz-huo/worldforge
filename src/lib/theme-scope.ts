/**
 * 主题变量作用域
 * ------------------------------------------------------------------
 * 亮暗两套调色板由 index.css 的 `:root` / `.dark` 提供（19 个变量），
 * 插件主题（registerTheme）则在它们之上**覆盖其中一部分**。
 *
 * 宿主把插件变量写成 `<html>` 的内联样式 —— 内联优先级最高，正好能压住上面
 * 那两套；但内联样式**只会新增、不会自己消失**。于是插件一停用，旧值还留在
 * 页面上继续盖住亮暗两套，表现为「切亮暗只有一部分元素变化」（实测：19 个
 * 主题变量里只有 9 个会动，连页面底色都不变）。
 *
 * 所以这里维护「宿主自己写过哪些键」，每次应用之前先清掉它们，再写新的一套：
 *  - 没有匹配到插件主题 → 只清不写，默认调色板立刻完整生效；
 *  - 换主题 / 换插件 → 换的是整张作用域，不残留上一个的任何变量；
 *  - 清理必须在**每次应用之前**做，不能只在停用那一刻做：切主题会让 effect
 *    重跑，若那时不清，上一次的值就会被一直盖着。
 *
 * 写成不依赖 DOM 的纯逻辑（只要求一个 setProperty/removeProperty 的宿主），
 * 这样自测里可以用假宿主逐条验证「清哪些、按什么顺序清」。
 */
export interface VarTarget {
  setProperty(prop: string, value: string): void;
  removeProperty(prop: string): void;
}

export interface ThemeScope {
  /** 应用一套变量；传 null/undefined = 交还给默认主题（只清不写） */
  apply(vars?: Record<string, string> | null): void;
  /** 当前由宿主写着的变量名（自测与排查用） */
  keys(): string[];
}

/** 只认真正的 CSS 自定义属性，且值非空 —— 插件写了个空值不该把主题变量抹掉 */
function isUsableVar(key: string, value: unknown): value is string {
  return key.startsWith('--') && typeof value === 'string' && value.trim() !== '';
}

export function createThemeScope(root: VarTarget): ThemeScope {
  const applied = new Set<string>();
  return {
    apply(vars) {
      for (const key of applied) root.removeProperty(key);
      applied.clear();
      if (!vars) return;
      for (const [key, value] of Object.entries(vars)) {
        if (!isUsableVar(key, value)) continue;
        root.setProperty(key, value);
        applied.add(key);
      }
    },
    keys: () => [...applied],
  };
}

/** 宿主单例：把插件主题变量应用到 <html> 上，返回这次写着的变量名 */
let hostScope: ThemeScope | null = null;

export function applyPluginTheme(vars?: Record<string, string> | null): string[] {
  if (typeof document === 'undefined') return [];
  hostScope ??= createThemeScope(document.documentElement.style);
  hostScope.apply(vars);
  return hostScope.keys();
}
