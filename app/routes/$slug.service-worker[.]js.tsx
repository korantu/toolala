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
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - take control and clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all([
        // Clean up old caches
        ...cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('${slug}-')) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        }),
        // Take control of all clients immediately
        self.clients.claim()
      ]);
    })
  );
});

// Fetch event - stale-while-revalidate strategy with offline fallback
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // If we have a cached response, return it immediately
      if (cachedResponse) {
        console.log('Serving from cache:', event.request.url);
        
        // Update cache in background (stale-while-revalidate)
        fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
                console.log('Updated cache for:', event.request.url);
              });
            }
          })
          .catch(error => {
            console.log('Background update failed:', error);
          });
        
        return cachedResponse;
      }
      
      // No cached response, try network
      return fetch(event.request)
        .then(networkResponse => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          // Clone the response for caching
          const responseClone = networkResponse.clone();
          
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
            console.log('Cached new response for:', event.request.url);
          });
          
          return networkResponse;
        })
        .catch(error => {
          console.log('Network fetch failed:', error);
          // Return a meaningful offline response for the main page
          if (event.request.url.includes('/${slug}/')) {
            return new Response(
              '<html><body><h1>Offline</h1><p>This page is not available offline. Please check your connection.</p></body></html>',
              { 
                headers: { 'Content-Type': 'text/html' },
                status: 503,
                statusText: 'Service Unavailable'
              }
            );
          }
          throw error;
        });
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