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
// Simple Service Worker for /${slug}/ - network-only, no caching
self.addEventListener('install', event => {
  console.log('Service Worker installing');
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim()); // Take control immediately
});

// Fetch event - pass all requests directly to network
self.addEventListener('fetch', event => {
  // Simply pass through to network, no caching
  event.respondWith(fetch(event.request));
});
`.trim();

  return new Response(serviceWorkerCode, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=0, must-revalidate"
    },
  });
}