/**
 * IndexedDB 薄封装
 * ------------------------------------------------------------------
 * 只做两件事：
 *  1. kv     —— 存放 SQLite 数据库的二进制快照；
 *  2. assets —— 存放图片 Blob（避免把二进制塞进 SQLite 撑爆内存数据库）。
 * 不引入 idb / dexie 等库，保持产物体积。
 */

const DB_NAME = 'worldforge';
const DB_VERSION = 1;

/** 对象仓库名 */
export const STORE_KV = 'kv';
export const STORE_ASSETS = 'assets';

let dbPromise: Promise<IDBDatabase> | null = null;

/** 打开（必要时创建）数据库 */
export function openIdb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** 在指定仓库执行一次事务 */
async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openIdb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 读取 */
export function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return withStore<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
}

/** 写入 */
export function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return withStore<undefined>(store, 'readwrite', (s) => s.put(value, key) as unknown as IDBRequest<undefined>).then(
    () => undefined,
  );
}

/** 删除 */
export function idbDelete(store: string, key: string): Promise<void> {
  return withStore<void>(store, 'readwrite', (s) => s.delete(key) as IDBRequest<void>);
}

/** 列出所有键 */
export function idbKeys(store: string): Promise<string[]> {
  return withStore<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()).then((keys) =>
    keys.map(String),
  );
}

/** 清空仓库 */
export function idbClear(store: string): Promise<void> {
  return withStore<undefined>(store, 'readwrite', (s) => s.clear() as unknown as IDBRequest<undefined>).then(
    () => undefined,
  );
}

/** 请求持久化存储配额，降低浏览器在存储紧张时清掉数据的概率 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* 忽略：部分浏览器不支持 */
  }
  return false;
}

/** 查询已用配额，设置页展示用 */
export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  try {
    const est = await navigator.storage?.estimate?.();
    return { usage: est?.usage ?? 0, quota: est?.quota ?? 0 };
  } catch {
    return { usage: 0, quota: 0 };
  }
}

/* ------------------------------ 资源 Blob ------------------------------ */

/** 保存图片 Blob */
export function putAssetBlob(id: string, blob: Blob): Promise<void> {
  return idbPut(STORE_ASSETS, id, blob);
}

/** 读取图片 Blob */
export function getAssetBlob(id: string): Promise<Blob | undefined> {
  return idbGet<Blob>(STORE_ASSETS, id);
}

/** 删除图片 Blob */
export function deleteAssetBlob(id: string): Promise<void> {
  return idbDelete(STORE_ASSETS, id);
}
