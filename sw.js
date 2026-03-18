// 🔥 黃金法則：每次發布新版本，一定要手動修改這裡的版號！(例如下一次改為 v2.8.5)
const APP_VERSION = "v2.9.6";
const CACHE_NAME = 'mahjong-cache-' + APP_VERSION;

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './data.js',
    './manifest.json',
    // App 圖標
    './icon-48.png', './icon-72.png', './icon-96.png', './icon-128.png',
    './icon-144.png', './icon-192.png', './icon-256.png', './icon-384.png', './icon-512.png',
    './icon-maskable-192.png', './icon-maskable-512.png',
    './privacy.html',
    // JS 模組
    './js/app.js',
    './js/constants.js',
    './js/state.js',
    './js/utils.js',
    './js/animation.js',
    './js/engine.js',
    './js/ui-input.js',
    './js/ui-result.js',
    './js/ui-history.js',
    './js/ui-wiki.js',
    './js/ui-profile.js',
    // 花牌 SVG
    './tiles/f1.svg', './tiles/f2.svg', './tiles/f3.svg', './tiles/f4.svg',
    './tiles/f5.svg', './tiles/f6.svg', './tiles/f7.svg', './tiles/f8.svg',
    // 索子 SVG
    './tiles/s1.svg', './tiles/s2.svg', './tiles/s3.svg', './tiles/s4.svg',
    './tiles/s5.svg', './tiles/s6.svg', './tiles/s7.svg', './tiles/s8.svg', './tiles/s9.svg',
    // 筒子 SVG
    './tiles/t1.svg', './tiles/t2.svg', './tiles/t3.svg', './tiles/t4.svg',
    './tiles/t5.svg', './tiles/t6.svg', './tiles/t7.svg', './tiles/t8.svg', './tiles/t9.svg',
    // 萬子 SVG
    './tiles/w1.svg', './tiles/w2.svg', './tiles/w3.svg', './tiles/w4.svg',
    './tiles/w5.svg', './tiles/w6.svg', './tiles/w7.svg', './tiles/w8.svg', './tiles/w9.svg',
    // 字牌 SVG
    './tiles/z1.svg', './tiles/z2.svg', './tiles/z3.svg', './tiles/z4.svg',
    './tiles/z5.svg', './tiles/z6.svg', './tiles/z7.svg'
];

// 1. 安裝階段：強制打破 HTTP 殭屍快取
self.addEventListener('install', (e) => {
    console.log('[SW] 安裝新版本:', CACHE_NAME);
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // 🌟 核心修復：在網址後面加上隨機時間戳，強迫伺服器給我們「最新」的檔案
            return Promise.all(
                urlsToCache.map((url) => {
                    const request = new Request(`${url}?_bust=${Date.now()}`, { cache: 'no-store' });
                    return fetch(request).then((response) => {
                        if (!response.ok) throw new Error(`Network error for ${url}`);
                        // 抓到最新檔案後，把它存回原本乾淨的 URL 鍵值中 (例如 './app.js')
                        return cache.put(url, response);
                    });
                })
            );
        })
    );
});

// 2. 啟動階段：刪除舊快取並「強制接管」
self.addEventListener('activate', (e) => {
    console.log('[SW] 啟動新版，清理舊快取');
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME && key !== 'google-fonts') {
                    console.log('[SW] 刪除舊快取:', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => {
            // 🌟 核心修復 2：強制新的 SW 立刻接管所有開啟的網頁
            return self.clients.claim();
        })
    );
});

// 3. 攔截請求：維持 Cache First 策略 + Google Fonts 動態快取
self.addEventListener('fetch', (e) => {
    // 防呆機制：如果是帶有時間戳的安裝請求，直接放行不攔截
    if (e.request.url.includes('?_bust=')) return;

    const url = e.request.url;

    // Google Fonts (CSS + 字型檔) → Stale-While-Revalidate
    if (url.startsWith('https://fonts.googleapis.com/') || url.startsWith('https://fonts.gstatic.com/')) {
        e.respondWith(
            caches.open('google-fonts').then((cache) =>
                cache.match(e.request).then((cached) => {
                    const fetched = fetch(e.request).then((res) => {
                        if (res.ok) cache.put(e.request, res.clone());
                        return res;
                    }).catch(() => cached);
                    return cached || fetched;
                })
            )
        );
        return;
    }

    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});

// 4. 接收來自 app.js 動態島的更新指令
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        console.log('[SW] 收到 SKIP_WAITING，立刻強制接班！');
        self.skipWaiting();
    }
});
