/* Sam Kent & Medway — safe navigation fix, 7 Nov 2026.
   Keeps the existing catalogue and quote links untouched.
   Does not decode or rewrite the 19 MB HTML during navigation.
   Keeps an offline copy of the catalogue opening document when possible.
   Scoped to /sam-kent-medway/; no other division is affected.
*/
'use strict';
const RJ_SHELL_CACHE = 'rj-sam-kent-shell-v2-20261107';
const RJ_OLD_SHELL_CACHE = 'rj-sam-kent-launch-fallback-v1';
const RJ_SCOPE = new URL(self.registration.scope);
const RJ_ENTRY = new URL('index.html', RJ_SCOPE).href;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function disconnectedPage() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R&J Kent & Medway</title><style>html,body{margin:0;min-height:100%;background:#0c1624;color:white;font:16px system-ui,Arial,sans-serif}main{max-width:480px;margin:22vh auto 0;padding:22px;text-align:center}h1{font-size:23px}button{padding:14px 20px;border:0;border-radius:10px;background:#e5bd5c;color:#141414;font-weight:900;font-size:18px}</style></head><body><main><h1>R&amp;J Kent &amp; Medway Catalogue</h1><p>Connection interrupted. Your catalogue and quotes have not been deleted.</p><button onclick="location.reload()">TRY AGAIN</button></main></body></html>`,
    {status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.origin !== RJ_SCOPE.origin || !url.pathname.startsWith(RJ_SCOPE.pathname)) return;

  event.respondWith((async () => {
    // Inspect only the cache index, not the cached 19 MB response body.
    let shellCache = null;
    let saved = null;
    try {
      shellCache = await caches.open(RJ_SHELL_CACHE);
      saved = await shellCache.match(RJ_ENTRY);
    } catch (_) { /* Private browsing or device quotas may block caching. */ }

    try {
      // Pass the browser's navigation straight through. Keep #rjppq/#rjppp links intact.
      const live = await fetch(req);
      if (live.ok) {
        if (!saved && shellCache && (live.headers.get('content-type') || '').includes('text/html')) {
          // One-time offline shell backup, off the critical path, never on every visit.
          const copy = live.clone();
          event.waitUntil(shellCache.put(RJ_ENTRY, copy).catch(() => {}));
        }
        return live;
      }
      // Return genuine errors rather than silently replacing a broken page.
      if (live.status !== 404 && live.status !== 503 && live.status !== 502 && live.status !== 504) return live;
    } catch (_) { /* Network unavailable: use last saved catalogue. */ }

    if (saved) return saved;
    try {
      const previousCache = await caches.open(RJ_OLD_SHELL_CACHE);
      const previous = await previousCache.match(RJ_ENTRY);
      if (previous) return previous;
    } catch (_) {}
    return disconnectedPage();
  })());
});
