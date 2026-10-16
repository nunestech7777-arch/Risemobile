// RiseMobile — service worker.
//
// Só guarda em cache a CASCA do app (HTML, JS/CSS com hash, ícones, fontes) para abrir rápido e
// abrir mesmo sem internet. Dados do negócio (Supabase, cotação do dólar, qualquer outro domínio)
// NUNCA passam por aqui: vão sempre direto à rede, para não mostrar estoque ou valores desatualizados.
//
// Para publicar uma nova versão do service worker, altere VERSION.
const VERSION = 'v1';
const SHELL_CACHE = `risemobile-shell-${VERSION}`;
const ASSET_CACHE = `risemobile-assets-${VERSION}`;
const FONT_CACHE = `risemobile-fonts-${VERSION}`;
const KEEP = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE];

const SHELL_URLS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon-32.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RiseMobile — sem conexão</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0E14;color:#e2e8f0;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:20px;margin:0 0 8px">Sem conexão</h1><p style="margin:0 0 16px;color:#94a3b8">Conecte-se à internet e tente novamente.</p>
<button onclick="location.reload()" style="background:#2563eb;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-size:15px">Tentar de novo</button></div></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('risemobile-') && !KEEP.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// O app avisa o usuário de que há nova versão; só troca quando ele aceitar.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Arquivos de versões antigas (nomes com hash) não são mais pedidos; mantém só os mais recentes.
const MAX_ASSETS = 60;
const trimCache = async (cacheName, max) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
};

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trimCache(cacheName, MAX_ASSETS);
  }
  return response;
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
};

const navigate = async (request) => {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('/', response.clone());
    return response;
  } catch {
    return (await cache.match('/')) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (/\.(png|jpg|jpeg|svg|ico|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});
