/**
 * 浏览器 API 的最小 Node 桩
 * ------------------------------------------------------------------
 * 数据层自测跑在 Node 里，但有些逻辑依赖浏览器 API。这里只补真正用到的部分，
 * 并且保证行为与浏览器一致 —— 桩的行为不一致会让测试变成假通过。
 *
 * 目前只有 FileReader（lib/assets.ts 的 blobToDataUrl 用它把图片转成 dataURL）。
 * IndexedDB / document / localStorage 的桩在 fake-idb.mjs 里（它们是另一类东西：
 * 静态检查不需要索引库，只有数据层测试才装）。
 */

/** 安装 FileReader 桩；已存在时不动（浏览器或未来 Node 自带版本优先） */
export function installFileReader() {
  if (typeof globalThis.FileReader === 'function') return;
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      void blob.arrayBuffer().then((buf) => {
        const mime = blob.type || 'application/octet-stream';
        this.result = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
        this.onload?.();
      }).catch((err) => {
        this.error = err;
        this.onerror?.(err);
      });
    }
  };
}
