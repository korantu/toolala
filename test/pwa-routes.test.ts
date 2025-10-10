import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { env } from "cloudflare:test";
import { createStorageManager } from "../app/lib/storage";
import { loader as manifestLoader } from "../app/routes/$slug.manifest[.]json";
import { loader as serviceWorkerLoader } from "../app/routes/$slug.service-worker[.]js";

describe("PWA Routes", () => {
  const testSlug = "test-pwa-page";
  let storage: ReturnType<typeof createStorageManager>;
  
  beforeEach(async () => {
    storage = createStorageManager(env);
    // Create a test page with React content
    await storage.setContent(testSlug, "import React from 'react';\nconst App = () => <div>PWA Test</div>;");
    await storage.setMeta(testSlug, {
      title: "PWA Test Page", 
      description: "A test page for PWA functionality"
    });
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await storage.deleteContent(testSlug);
      await storage.deleteMeta(testSlug);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("manifest.json route", () => {
    it("returns valid PWA manifest with correct metadata", async () => {
      const context = { cloudflare: { env } };
      const params = { slug: testSlug };
      
      const response = await manifestLoader({ params, context } as any);
      const text = await response.text();
      const manifest = JSON.parse(text);

      expect(response.headers.get("Content-Type")).toBe("application/manifest+json");
      expect(manifest.name).toBe("PWA Test Page");
      expect(manifest.short_name).toBe("PWA Test Page");
      expect(manifest.description).toBe("A test page for PWA functionality");
      expect(manifest.start_url).toBe(`/${testSlug}/`);
      expect(manifest.display).toBe("standalone");
      expect(manifest.background_color).toBe("#ffffff");
      expect(manifest.theme_color).toBe("#ffffff");
      expect(manifest.icons).toHaveLength(1);
      expect(manifest.icons[0].src).toBe("/favicon.svg");
    });

    it("returns 404 for non-existent page", async () => {
      const context = { cloudflare: { env } };
      const params = { slug: "non-existent-page" };
      
      try {
        await manifestLoader({ params, context } as any);
        expect.fail("Expected loader to throw 404 error");
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });
  });

  describe("service-worker.js route", () => {
    it("returns valid service worker script with network-only strategy", async () => {
      const context = { cloudflare: { env } };
      const params = { slug: testSlug };
      
      const response = await serviceWorkerLoader({ params, context } as any);
      const serviceWorkerCode = await response.text();

      expect(response.headers.get("Content-Type")).toBe("application/javascript");
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
      
      // Check service worker contains the basic event listeners
      expect(serviceWorkerCode).toContain("addEventListener('install'");
      expect(serviceWorkerCode).toContain("addEventListener('fetch'");
      expect(serviceWorkerCode).toContain("addEventListener('activate'");
      expect(serviceWorkerCode).toContain("fetch(event.request)");
      expect(serviceWorkerCode).toContain("self.skipWaiting()");
      expect(serviceWorkerCode).toContain("self.clients.claim()");
    });

    it("returns 404 for non-existent page", async () => {
      const context = { cloudflare: { env } };
      const params = { slug: "non-existent-page" };
      
      try {
        await serviceWorkerLoader({ params, context } as any);
        expect.fail("Expected loader to throw 404 error");
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });
  });
});