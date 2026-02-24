// ✨ 使用 importScripts 載入共用的版本號檔案
importScripts('version.js');

// 動態結合 APP_VERSION 產生快取名稱
const CACHE_NAME = 'mahjong-cache-' + APP_VERSION;

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './version.js' // 🔥 記得要把 version.js 也加進快取清單中！
];

// ... 下面的 self.addEventListener('install' ... 等代碼完全不用動，保持原樣即可 ...self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});

// 接收來自 app.js 的指令：瞬間切換到新版本
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});