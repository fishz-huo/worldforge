/**
 * 文件导出：把文本/二进制存到用户自己选的位置
 * ------------------------------------------------------------------
 * 桌面版（Tauri）与网页版的能力不一样，这里做统一封装：
 *  - 桌面版：调系统「另存为」对话框，用户自己挑目录与文件名；
 *    文件由 Rust 侧直接写盘（命令 `save_file`），前端不需要文件系统权限。
 *  - 网页版：浏览器不允许脚本选路径，只能交给浏览器的下载行为
 *    （下载目录在浏览器设置里改，或者下载时用「另存为」）。
 *
 * 这个模块是**唯一**需要区分运行环境的地方；插件用动态 import 载入，
 * 因此网页构建里不会把桌面端的 JS 打进主包。
 */

/** 导出结果：path 为空表示走了浏览器下载 */
export interface SaveOutcome {
  ok: boolean;
  /** 用户取消保存对话框 */
  canceled?: boolean;
  /** 桌面端写盘成功后的完整路径 */
  path?: string;
  error?: string;
}

/** 是否运行在 Tauri 桌面/移动壳里（网页版没有这个全局对象） */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

/**
 * 让用户选择保存位置并写盘（仅在桌面端有效）。
 * 未选路径 / 用户取消 → canceled；写盘失败 → ok:false + error。
 */
async function saveViaDesktop(filename: string, data: string | Uint8Array): Promise<SaveOutcome> {
  try {
    const [{ save }, { invoke }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/api/core'),
    ]);
    const selected = await save({
      title: '选择导出位置',
      defaultPath: filename,
      // 让「另存为」对话框带上正确的类型过滤（Windows / macOS 都认）
      filters: filename.endsWith('.sqlite')
        ? [{ name: 'SQLite 数据库', extensions: ['sqlite', 'db'] }]
        : [{ name: 'JSON 备份', extensions: ['json'] }],
    });
    if (!selected) return { ok: false, canceled: true };
    // Rust 侧写盘：内容以字节数组传输，避免大文件走 JSON 字符串的开销
    const bytes = typeof data === 'string' ? Array.from(new TextEncoder().encode(data)) : Array.from(data);
    await invoke('save_file', { path: selected, contents: bytes });
    return { ok: true, path: selected };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 网页版兜底：交给浏览器的下载行为 */
function saveViaBrowser(filename: string, data: string | Uint8Array, mime: string): SaveOutcome {
  const blob = new Blob([data as unknown as BlobPart], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
}

/**
 * 导出文本或二进制。
 * @param filename 建议的文件名（桌面端会作为对话框里的默认名）
 */
export async function saveFile(
  filename: string,
  data: string | Uint8Array,
  mime = 'application/json',
): Promise<SaveOutcome> {
  if (isDesktop()) return saveViaDesktop(filename, data);
  return saveViaBrowser(filename, data, mime);
}

/** 把文件名里的非法字符换成下划线，避免 Windows 上写盘失败 */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'worldforge';
}

/**
 * 让用户挑一个目录（桌面端）。
 * 一次导出常常是「多个区域 × 多种格式」的一堆文件，逐个弹「另存为」太烦人，
 * 所以先选一次目录，再让 Rust 批量写进去（见 lib/save-batch.ts）。
 * 网页版没有目录权限，返回 null，调用方退化成浏览器下载。
 */
export async function pickDirectory(defaultPath?: string): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      title: '选择导出位置',
      directory: true,
      multiple: false,
      ...(defaultPath ? { defaultPath } : {}),
    });
    return typeof selected === 'string' ? selected : null;
  } catch (err) {
    console.error('[worldforge] 选择导出目录失败', err);
    return null;
  }
}
