/**
 * Service Worker（离线可用）
 * ------------------------------------------------------------------
 * 需求 7：多端运行 + 可安装。这里用「运行时缓存」策略：
 *  - 应用外壳（HTML/JS/CSS）走 stale-while-revalidate，离线也能打开；
 *  - 其余同源 GET 请求走 cache-first 并写入缓存；
 *  - 不做预缓存清单，因此不需要构建期生成 hash 列表。
 * 注意：业务数据存在 IndexedDB，不经由网络，SW 不接触数据。
 */
const CACHE = 'worldforge-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 应用外壳：先给缓存，后台更新
  const isShell = request.mode === 'navigate' || /\.(html|js|css)$/.test(url.pathname);
  if (isShell) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch (err) {
        return cached || Response.error();
      }
    }),
  );
});
