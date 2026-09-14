/**
 * 极简 CDP 客户端（开发期调试用，不进构建产物）
 * ==================================================================
 * 为什么需要它：沙箱里没有 Playwright / Puppeteer，但 Node 24 自带
 * `fetch` 与 `WebSocket`，而 Chrome 自己就是 CDP 服务端。
 * 于是「给页面里的元素量一下坐标」不需要装任何依赖。
 *
 * 用法（先手动开一个 headless Chrome，见 scripts/ui-probe.mjs 顶部注释）：
 *   node scripts/ui-probe.mjs
 */
export const CDP_PORT = Number(process.env.WF_CDP_PORT ?? 9222);

/** 等 DevTools HTTP 端点起来（Chrome 启动要几百毫秒） */
export async function waitForCdp(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      /* 还没起来，继续等 */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`CDP 端口 ${CDP_PORT} 在 ${timeoutMs}ms 内没有响应`);
}

/** 建一个新标签页并连上它 */
export async function openPage(url) {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let seq = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
    }
    const slot = pending.get(msg.id);
    if (!slot) return;
    pending.delete(msg.id);
    if (msg.error) slot.reject(new Error(`${slot.method}: ${msg.error.message}`));
    else slot.resolve(msg.result);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params }));
    });

  /** 在页面里跑一段函数体，返回它的返回值（必须是可 JSON 序列化的） */
  const evaluate = async (fnBody) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression: `(() => { ${fnBody} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text ?? '页面内脚本抛错');
    return result.value;
  };

  return { send, evaluate, close: () => ws.close(), targetId: target.id, logs };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
