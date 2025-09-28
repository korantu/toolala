import { type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { createStorageManager } from "../lib/storage";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug!;

  const storage = createStorageManager(context.cloudflare.env);
  const content = await storage.getContent(slug);
  
  if (!content) {
    throw new Response("Not found", { status: 404 });
  }

  const serviceWorkerCode = `
// Service Worker for /${slug}/
const CACHE_NAME = '${slug}-v1';
const urlsToCache = [
  '/${slug}/',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - stale-while-revalidate strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Update cache with fresh response
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
        
        // Return cached version if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('${slug}-')) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
`.trim();

  return new Response(serviceWorkerCode, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=0, must-revalidate"
    },
  });
}