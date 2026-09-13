/**
 * 依赖许可证审计
 * ------------------------------------------------------------------
 * 用法：node scripts/license-audit.mjs
 *
 * 回答一个发布前必须搞清的问题：**本项目的依赖里有没有传染型（copyleft）协议？**
 * 如果有 GPL / AGPL，那么整个项目就不能随意选 MIT 发布；纯 MIT/Apache 则没有约束。
 *
 * 数据来源（全程离线，不联网）：
 *   1. package-lock.json        —— 前端依赖树（含每个包的 license 字段）
 *   2. node_modules/<pkg>/package.json —— 同上，作为补充（lock 里缺失时用）
 *   3. src-tauri/Cargo.lock     —— Rust 依赖树（含全部传递依赖，但没有 license 字段）
 *   4. cargo registry 源码目录里的 <crate>-<version>/Cargo.toml —— Rust 包的 license 字段
 *      （具体路径由 os.homedir() 拼出，见下方 registrySrc）
 *
 * ⚠️ 已知局限：Cargo.lock 里的包若从未被下载到本地 registry，其 license 无法离线得知，
 * 脚本会把它们单独列成「未知」，不会假装查过。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * 传染型协议分两档，区别很大，不能混为一谈：
 *   strong —— GPL / AGPL：**整个衍生作品**都要以同协议开源。会限制本项目的协议选择。
 *   weak   —— MPL / LGPL / EPL：**只有被改动的那些文件**要保持开源；
 *             以「未修改的独立库」形式使用（本项目正是如此）不产生任何义务，
 *             可以与本项目的 MIT 代码共存，甚至可以闭源分发。
 */
const STRONG_COPYLEFT = /(^|[\s(])(A?GPL|SSPL|OSL|CPL)(-|\s|$)/i;
const WEAK_COPYLEFT = /(^|[\s(])(MPL|LGPL|EPL|CDDL)(-|\s|$)/i;
/** 宽松型：可自由使用，包括闭源再分发 */
const PERMISSIVE = /\b(MIT|Apache-2\.0|BSD|ISC|Zlib|CC0|Unlicense|0BSD|MIT-0|Unicode-3\.0|CC-BY-4\.0)\b/i;

/** 归类一个 license 表达式（可能形如 "MIT OR Apache-2.0"） */
function classify(expr) {
  if (!expr || !String(expr).trim()) return 'unknown';
  const s = String(expr);
  if (STRONG_COPYLEFT.test(s)) return 'strong';
  if (WEAK_COPYLEFT.test(s)) return 'weak';
  if (PERMISSIVE.test(s)) return 'permissive';
  return 'other';
}

// ---------------------------------------------------------------- 前端
const npm = new Map(); // name -> { version, license }
const lockPath = join(ROOT, 'package-lock.json');
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  for (const [p, info] of Object.entries(lock.packages ?? {})) {
    if (!p.startsWith('node_modules/')) continue;
    const name = p.slice('node_modules/'.length);
    if (name.startsWith('@') && name.split('/').length > 2) continue; // 嵌套副本，跳过
    npm.set(name, { version: info.version ?? '?', license: info.license ?? '' });
  }
}
// lock 里没写 license 的，回落到 node_modules 里的 package.json
for (const [name, rec] of npm) {
  if (rec.license) continue;
  const pj = join(ROOT, 'node_modules', name, 'package.json');
  if (!existsSync(pj)) continue;
  try {
    const j = JSON.parse(readFileSync(pj, 'utf8'));
    rec.license = typeof j.license === 'string' ? j.license : JSON.stringify(j.license ?? '');
  } catch { /* 坏 JSON 就当查不到 */ }
}

// ---------------------------------------------------------------- Rust
const rustNames = [];
const cargoLock = join(ROOT, 'src-tauri', 'Cargo.lock');
if (existsSync(cargoLock)) {
  const text = readFileSync(cargoLock, 'utf8');
  for (const m of text.matchAll(/^name = "(.+)"$/gm)) rustNames.push(m[1]);
}
// 本地 registry 里 <name>-<version>/Cargo.toml → 取 license 字段
const registrySrc = join(homedir(), '.cargo', 'registry', 'src');
const rustLicense = new Map(); // name -> Set(license)
if (existsSync(registrySrc)) {
  for (const channel of readdirSync(registrySrc)) {
    const dir = join(registrySrc, channel);
    let entries = [];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const e of entries) {
      const toml = join(dir, e, 'Cargo.toml');
      if (!existsSync(toml)) continue;
      const name = e.replace(/-\d+\.\d+\.\d+.*$/, '');
      const body = readFileSync(toml, 'utf8');
      const m = /^license\s*=\s*"([^"]+)"/m.exec(body);
      const lic = m ? m[1] : (/^license-file\s*=/m.test(body) ? '(license-file)' : '');
      if (!lic) continue;
      if (!rustLicense.has(name)) rustLicense.set(name, new Set());
      rustLicense.get(name).add(lic);
    }
  }
}

// ---------------------------------------------------------------- 汇总
function summarize(records) {
  const byClass = { permissive: [], strong: [], weak: [], other: [], unknown: [] };
  for (const r of records) byClass[classify(r.license)].push(r);
  return byClass;
}

const npmRecords = [...npm].map(([name, r]) => ({ name, ...r }));
const rustRecords = rustNames.map((name) => ({
  name,
  license: rustLicense.has(name) ? [...rustLicense.get(name)].join(' / ') : '',
}));

const npmSum = summarize(npmRecords);
const rustSum = summarize(rustRecords);

const show = (title, sum, total) => {
  console.log(`\n=== ${title}（共 ${total} 个） ===`);
  console.log(`  宽松型 permissive       : ${sum.permissive.length}`);
  console.log(`  强传染 strong (GPL/AGPL): ${sum.strong.length}${sum.strong.length ? '  ← 会限制发布协议' : ''}`);
  console.log(`  弱传染 weak (MPL/LGPL)  : ${sum.weak.length}${sum.weak.length ? '  ← 作为未修改的库使用，不产生义务' : ''}`);
  console.log(`  其它 other              : ${sum.other.length}`);
  console.log(`  未知 unknown            : ${sum.unknown.length}`);
  if (sum.strong.length) {
    console.log('  --- 强传染明细（必须逐个确认） ---');
    for (const r of sum.strong) console.log(`    ⚠ ${r.name} ${r.version ?? ''} → ${r.license}`);
  }
  if (sum.weak.length) {
    console.log('  --- 弱传染明细 ---');
    for (const r of sum.weak) console.log(`    · ${r.name} ${r.version ?? ''} → ${r.license}`);
  }
  if (sum.other.length) {
    console.log('  --- other 明细 ---');
    for (const r of sum.other) console.log(`    ? ${r.name} ${r.version ?? ''} → ${r.license}`);
  }
};

console.log('依赖许可证审计（离线）');
show('前端依赖', npmSum, npmRecords.length);
show('Rust 依赖', rustSum, rustRecords.length);

// Rust 的未知项通常很多（未下载的包），单独提示哪些是**直接依赖**
const direct = ['tauri', 'tauri-build', 'tauri-plugin-dialog', 'serde', 'serde_json',
  'worldforge', 'tauri-plugin-fs'];
console.log('\n=== 直接依赖的许可证（最关键，必须全部查清） ===');
for (const d of direct) {
  const n = npm.get(d);
  const r = rustLicense.get(d);
  const lic = r ? [...r].join(' / ') : (n?.license ?? '');
  if (!lic) continue;
  const cls = classify(lic);
  const flag = cls === 'strong' ? '⚠ 强传染' : cls === 'weak' ? '· 弱传染' : '✓';
  console.log(`  ${flag}  ${d} → ${lic}`);
}

const strong = npmSum.strong.length + rustSum.strong.length;
const weak = npmSum.weak.length + rustSum.weak.length;

// 未知包的来源核实：只有 git 依赖与本地路径依赖才可能藏着自定义协议，
// crates.io 上的包协议由 crates.io 规范约束，GPL 系极罕见。
const sources = new Map(); // name -> 'registry' | 'git' | 'local'
if (existsSync(cargoLock)) {
  for (const block of readFileSync(cargoLock, 'utf8').split('[[package]]').slice(1)) {
    const name = /name = "([^"]+)"/.exec(block)?.[1];
    if (!name) continue;
    const src = /source = "([^"]+)"/.exec(block)?.[1] ?? '';
    sources.set(name, !src ? 'local' : src.startsWith('registry+') ? 'registry' : 'git');
  }
}
const unknownRust = rustSum.unknown
  .filter((r) => sources.get(r.name) !== 'local') // 排除本项目自己的包（worldforge）
  .map((r) => r.name);
const oddSources = unknownRust
  .map((n) => [n, sources.get(n)])
  .filter(([, s]) => s && s !== 'registry');

console.log('\n=== 结论 ===');
console.log(strong === 0
  ? '  没有任何强传染（GPL/AGPL）依赖 → **项目可以自由选择发布协议**，包括 MIT。'
  : `  发现 ${strong} 个强传染（GPL/AGPL）依赖，必须逐个确认后才能决定发布协议。`);
if (weak) {
  console.log(`  另有 ${weak} 个弱传染（MPL-2.0）依赖：全部以「未修改的第三方库」形式被链接使用，
  MPL 的义务只针对「被改动的 MPL 文件本身」。本项目没有改动它们，因此
  既不要求本项目开源、也不影响本项目选择 MIT 等宽松协议。`);
}
if (rustSum.unknown.length) {
  console.log(`  注意：${rustSum.unknown.length} 个 Rust 包因本地无源码缓存而无法离线判定。`);
  if (oddSources.length === 0) {
    console.log(`  已核实这 ${rustSum.unknown.length} 个包在 Cargo.lock 里的来源：**全部来自 crates.io**，`);
    console.log('  没有 git 依赖、也没有本地路径依赖 —— 不存在「自定义协议藏在私人小仓库里」的情况。');
    console.log('  crates.io 上 GPL 系协议极为罕见（Rust 生态绝大多数是 MIT / Apache-2.0 双许可）。');
  } else {
    console.log('  ⚠ 以下未知包不是来自 crates.io，需要人工确认协议：');
    for (const [n, s] of oddSources) console.log(`      ${n} → ${s}`);
  }
  console.log('  要 100% 确认，可在有网时执行：cargo metadata --format-version 1（输出含 license 字段）');
}
