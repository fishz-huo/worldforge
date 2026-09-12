/**
 * 内存版 IndexedDB 桩
 * ------------------------------------------------------------------
 * 只实现本项目用到的 API 子集：open / onupgradeneeded / transaction /
 * objectStore / get / put / delete / getAllKeys / clear。
 * 请求回调异步触发，行为与真实 IndexedDB 一致（这是能测出问题的关键）。
 */
export function installFakeIndexedDB() {
  const databases = new Map();

  /**
   * 请求对象工厂。
   * 注意：回调必须在微任务里「重新读取」request.onsuccess，
   * 因为调用方是在拿到 request 之后才挂回调的（真实 IndexedDB 同理）。
   */
  const makeRequest = () => {
    const request = { result: undefined, error: null, onsuccess: null, onerror: null };
    const settle = (value) => {
      queueMicrotask(() => {
        request.result = value;
        request.onsuccess?.(value);
      });
    };
    return { request, settle };
  };

  const createStore = (data) => ({
    get(key) {
      const { request, settle } = makeRequest();
      settle(data.get(key));
      return request;
    },
    put(value, key) {
      const { request, settle } = makeRequest();
      data.set(key, value);
      settle(key);
      return request;
    },
    delete(key) {
      const { request, settle } = makeRequest();
      data.delete(key);
      settle(undefined);
      return request;
    },
    getAllKeys() {
      const { request, settle } = makeRequest();
      settle([...data.keys()]);
      return request;
    },
    clear() {
      const { request, settle } = makeRequest();
      data.clear();
      settle(undefined);
      return request;
    },
  });

  const indexedDB = {
    open(name, version) {
      const request = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        let entry = databases.get(name);
        if (!entry) {
          entry = { stores: new Map(), version };
          databases.set(name, entry);
        }
        const db = {
          objectStoreNames: { contains: (storeName) => entry.stores.has(storeName) },
          createObjectStore: (storeName) => {
            entry.stores.set(storeName, new Map());
            return createStore(entry.stores.get(storeName));
          },
          transaction: (storeName) => ({
            objectStore: (target) => createStore(entry.stores.get(target ?? storeName)),
          }),
        };
        request.result = db;
        if (!entry.stores.size) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };

  globalThis.indexedDB = indexedDB;
  return { databases };
}

/** 最小 DOM / 存储桩：让 store 与 db 模块能在 Node 里 import 与运行 */
export function installBrowserStubs() {
  const listeners = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
    visibilityState: 'visible',
    createElement: () => ({ click() {}, style: {}, set href(v) {}, set download(v) {} }),
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { reload() {} } };
  // Node 24 里 navigator 是只读 getter，需要 defineProperty 覆盖；
  // 覆盖失败也无所谓：代码里对 navigator.storage 都做了可选链与 try/catch。
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { storage: { persist: async () => false, estimate: async () => ({ usage: 0, quota: 0 }) } },
      configurable: true,
      writable: true,
    });
  } catch {
    /* 保留宿主实现 */
  }
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.URL.createObjectURL = () => 'blob:stub';
  globalThis.URL.revokeObjectURL = () => {};
  void listeners;
}
