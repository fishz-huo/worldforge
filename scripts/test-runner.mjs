/**
 * 极简测试运行器
 * ------------------------------------------------------------------
 * 不引入 vitest/jest：这些自测跑在 Node 里，只需要「断言 + 计数 + 退出码」。
 * 每个测试文件末尾调用 finish()，失败时以非 0 退出码结束，便于 CI 串联。
 */
import assert from 'node:assert/strict';

export { assert };

let passed = 0;
let failed = 0;

/** 打印分组标题 */
export function group(name) {
  console.log(`\n${name}`);
}

/** 运行一个测试；同步或异步回调都支持 */
export async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

/** 输出汇总并设置退出码 */
export function finish(label = '') {
  const suffix = label ? `（${label}）` : '';
  console.log(`\n结果${suffix}：${passed} 项通过，${failed} 项失败`);
  process.exit(failed === 0 ? 0 : 1);
}

/** 当前统计（跨文件汇总时用） */
export function stats() {
  return { passed, failed };
}
