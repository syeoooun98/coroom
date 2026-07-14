// coroom 서비스워커
// 오프라인이어도 마지막 화면(앱 셸 + 마지막으로 불러온 데이터)을 보여주기 위한 캐싱 전략

const SHELL_CACHE = 'coroom-shell-v1';
const API_CACHE = 'coroom-api-v1';

const SUPABASE_ORIGIN = 'https://reawosbtamhyeqorngfw.supabase.co';

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './supabaseClient.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  './icons/favicon.ico',
];

// ---------- install: 앱 셸 캐싱 ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

// ---------- activate: 이전 버전 캐시 정리 ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1) 네비게이션 요청: network-first, 실패 시 캐시된 index.html 폴백
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', clone));
          return response;
        })
        .catch(() =>
          caches.match('./index.html', { cacheName: SHELL_CACHE }).then(
            (cached) => cached || caches.match(request)
          )
        )
    );
    return;
  }

  // 2) Supabase REST GET 요청: network-first, 실패 시 런타임 캐시 폴백 (쓰기 요청은 캐싱하지 않음)
  if (url.origin === SUPABASE_ORIGIN) {
    if (request.method !== 'GET') {
      // POST/PATCH 등 쓰기 요청은 캐싱하지 않고 그대로 네트워크로 보냄
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request, { cacheName: API_CACHE }))
    );
    return;
  }

  // 3) 같은 출처의 정적 자산: cache-first, 없으면 network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request, { cacheName: SHELL_CACHE }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 그 외(다른 출처의 요청, 예: supabase-js CDN)는 기본 동작에 맡김
});
