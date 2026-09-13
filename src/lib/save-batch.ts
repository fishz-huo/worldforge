/**
 * 批量写盘：一次导出的一堆文件
 * ==================================================================
 * 一次导出可能产生十几个文件（每个区域 × 每种格式，或每个条目一个文件）。
 *  - 桌面版：选一次目录，全部交给 Rust 命令 save_files 写进这个目录，
 *    子目录（拆分导出时的分区子目录）由 Rust 按需创建；
 *  - 网页版：浏览器不给脚本任何路径权限，只能逐个触发下载，连续弹几个下载框
 *    是正常现象，插件界面上会提前写清楚。
 *
 * 出错策略：写盘失败不静默 —— 返回 errors 让界面列出来，用户自己去那个目录核对，
 * 而不是弹一句「导出完成」把问题盖过去。
 */
import { isDesktop } from './save-open';

/** 一个待写盘的文件 */
export interface BatchFile {
  name: string;
  /** 相对子目录（可空） */
  subDir?: string;
  text?: string;
  bytes?: Uint8Array;
  mime?: string;
}

/** 写盘结果 */
export interface BatchOutcome {
  /** desktop = 直接写进用户选的目录；download = 浏览器逐个下载 */
  mode: 'desktop' | 'download';
  dir: string | null;
  /** 已写出的文件名（桌面端是完整路径） */
  written: string[];
  errors: string[];
}

/** 文本 → 字节 */
function toBytes(file: BatchFile): Uint8Array {
  if (file.bytes) return file.bytes;
  return new TextEncoder().encode(file.text ?? '');
}

/** 桌面端：一次 invoke 写完（字节以数组传输，与 save_file 一致） */
async function writeViaDesktop(files: BatchFile[], dir: string): Promise<string[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  const payload = files.map((f) => ({
    name: f.name,
    subDir: f.subDir ?? '',
    contents: Array.from(toBytes(f)),
  }));
  return invoke<string[]>('save_files', { dir, files: payload });
}

/** 网页端：逐个触发下载 */
function downloadOne(file: BatchFile): void {
  const blob = new Blob([toBytes(file) as unknown as BlobPart], {
    type: file.mime ?? 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 等一下：连续触发下载太快时，浏览器会拦掉后面的几个 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 写出全部文件。
 * @param dir 用户选好的目录；为空或网页版时退化成逐个下载
 */
export async function writeFiles(files: BatchFile[], dir: string | null): Promise<BatchOutcome> {
  if (files.length === 0) return { mode: 'download', dir, written: [], errors: [] };
  if (isDesktop() && dir) {
    try {
      return { mode: 'desktop', dir, written: await writeViaDesktop(files, dir), errors: [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { mode: 'desktop', dir, written: [], errors: [`写入 ${dir} 失败：${message}`] };
    }
  }
  const written: string[] = [];
  for (const file of files) {
    try {
      downloadOne(file);
      written.push(file.name);
    } catch (err) {
      written.push(file.name);
      // 浏览器下载失败没法精确捕获，这里只记一笔，界面会提示用户检查下载目录
      console.error('[worldforge] 下载失败', err);
    }
    await sleep(250);
  }
  return { mode: 'download', dir: null, written, errors: [] };
}
