/**
 * 版本号同步
 * ==================================================================
 * 为什么需要脚本：版本号散落在 5 个文件里（外加 Cargo.lock 里的一份副本），
 * 手工改一定会漏。漏掉的后果不是"看着不一致"这么轻 ——
 * 打包出来的安装包文件名与"关于"里显示的版本会对不上，
 * 而用户判断"我装的是哪一版"全靠这两个地方。
 *
 * 事实来源（single source of truth）：package.json 的 version。
 * 其余四处都是它的副本，由这个脚本写下去。
 *
 * 用法：
 *   node scripts/set-version.mjs 0.2.0     # 改版本
 *   node scripts/set-version.mjs           # 只校验五处是否一致（npm test 用）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/** 需要保持同步的位置：文件 + 用正则找到版本号并替换 */
const TARGETS = [
  {
    file: 'package.json',
    why: 'npm / Vite / 事实来源',
    read: (t) => JSON.parse(t).version,
    write: (t, v) => t.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`),
  },
  {
    file: 'src-tauri/tauri.conf.json',
    why: '打包 MSI / NSIS 时用它命名产物',
    read: (t) => JSON.parse(t).version,
    write: (t, v) => t.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`),
  },
  {
    file: 'src-tauri/Cargo.toml',
    why: 'Rust 侧版本（Windows 文件属性里显示的就是它）',
    read: (t) => /^version\s*=\s*"([^"]+)"/m.exec(t)?.[1],
    write: (t, v) => t.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${v}$2`),
  },
  {
    file: 'src/main.tsx',
    why: 'window.WorldForge.version（插件在浏览器里读它）',
    read: (t) => /version:\s*'([^']+)'/.exec(t)?.[1],
    write: (t, v) => t.replace(/(version:\s*')[^']+(')/, `$1${v}$2`),
  },
  {
    file: 'src/lib/plugin/host.ts',
    why: 'HOST_VERSION：插件据此做兼容判断',
    read: (t) => /HOST_VERSION\s*=\s*'([^']+)'/.exec(t)?.[1],
    write: (t, v) => t.replace(/(HOST_VERSION\s*=\s*')[^']+(')/, `$1${v}$2`),
  },
];

/** Cargo.lock 里也有 worldforge 自己的版本（由 cargo 生成，构建时自动更新） */
const LOCK = 'src-tauri/Cargo.lock';

function readAll() {
  return TARGETS.map((t) => ({ ...t, current: t.read(readFileSync(join(ROOT, t.file), 'utf8')) }));
}

const requested = process.argv[2];

if (!requested) {
  /* ------------------------------ 校验模式 ------------------------------ */
  const all = readAll();
  const source = all[0].current;
  const mismatched = all.filter((t) => t.current !== source);
  const lockVersion = /name = "worldforge"\s*\nversion = "([^"]+)"/.exec(readFileSync(join(ROOT, LOCK), 'utf8'))?.[1];

  console.log(`[set-version] package.json = ${source}`);
  all.forEach((t) => {
    const mark = t.current === source ? 'OK  ' : '差异';
    console.log(`  ${mark} ${t.current ?? '(未找到)'}  ${t.file}  —— ${t.why}`);
  });
  console.log(`  ${lockVersion === source ? 'OK  ' : '注意'} ${lockVersion ?? '(未找到)'}  ${LOCK}  —— 由 cargo 在构建时改写`);

  if (mismatched.length) {
    console.error(`\n[set-version] 有 ${mismatched.length} 处与 package.json 不一致：`);
    mismatched.forEach((t) => console.error(`  ${t.file}: ${t.current}`));
    console.error('修法：node scripts/set-version.mjs <版本号>');
    process.exit(1);
  }
  console.log('[set-version] 五处版本号一致');
  process.exit(0);
}

if (!/^\d+\.\d+\.\d+$/.test(requested)) {
  console.error(`[set-version] 版本号要写成 x.y.z（收到「${requested}」）`);
  process.exit(1);
}

/* ------------------------------ 写入模式 ------------------------------ */
TARGETS.forEach((t) => {
  const path = join(ROOT, t.file);
  const text = readFileSync(path, 'utf8');
  const before = t.read(text);
  if (before === requested) {
    console.log(`  = ${t.file}（已是 ${requested}）`);
    return;
  }
  const next = t.write(text, requested);
  if (t.read(next) !== requested) {
    console.error(`  ✗ ${t.file}：替换后读回来不是 ${requested}，正则可能没命中，已放弃写入`);
    process.exit(1);
  }
  writeFileSync(path, next, 'utf8');
  console.log(`  ✓ ${t.file}  ${before} → ${requested}`);
});

console.log(`\n[set-version] 已设为 ${requested}`);
console.log('提醒：src-tauri/Cargo.lock 里的版本由 cargo 在下次构建时自动更新，不必手改。');
console.log('提醒：打包产物的文件名会带上这个版本号，所以改完要重新构建安装包。');
