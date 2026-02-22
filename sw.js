const CACHE_NAME = 'mahjong-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // 如果你的 tiles 資料夾有很多圖片，為了節省首次載入時間，可以只緩存核心介面
  // 瀏覽器會在有網路時自動抓取未緩存的圖片
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果緩存裡有，就直接給緩存（秒開）；沒有就去網路抓
        return response || fetch(event.request);
      })
  );
});