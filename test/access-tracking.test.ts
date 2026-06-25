import { describe, expect, it } from "vitest";
import { createStorageManager, UnifiedStorageManager } from "../app/lib/storage";

// Mock KV namespace for testing
const createMockKV = (): any => {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) || null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async (options?: { prefix?: string; limit?: number }) => {
      const keys = Array.from(store.keys());
      const filtered = options?.prefix 
        ? keys.filter(k => k.startsWith(options.prefix!))
        : keys;
      const limited = options?.limit 
        ? filtered.slice(0, options.limit)
        : filtered;
      return {
        keys: limited.map(name => ({ name }))
      };
    },
    // Add access to internal store for testing
    store
  };
};

describe("Access Tracking", () => {
  describe("getAccessTimestamp", () => {
    it("should return null for pages with no access timestamp", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      
      const timestamp = await storage.getAccessTimestamp("never-accessed");
      
      expect(timestamp).toBeNull();
    });

    it("should return the stored timestamp", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const now = Date.now();
      
      await storage.setAccessTimestamp("test-page", now);
      const timestamp = await storage.getAccessTimestamp("test-page");
      
      expect(timestamp).toBe(now);
    });

    it("should handle invalid timestamp data", async () => {
      const mockKV = createMockKV();
      await mockKV.put("accessedts:broken", "not-a-number");
      const storage = new UnifiedStorageManager(mockKV);
      
      const timestamp = await storage.getAccessTimestamp("broken");
      
      expect(timestamp).toBeNull();
    });
  });

  describe("setAccessTimestamp", () => {
    it("should store timestamp with accessedts: prefix", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const now = Date.now();
      
      await storage.setAccessTimestamp("test-page", now);
      
      // Verify it was stored with the correct prefix
      expect(await mockKV.get("accessedts:test-page")).toBe(now.toString());
    });

    it("should update existing timestamp", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const firstAccess = Date.now();
      const secondAccess = firstAccess + 1000;
      
      await storage.setAccessTimestamp("test-page", firstAccess);
      await storage.setAccessTimestamp("test-page", secondAccess);
      
      const timestamp = await storage.getAccessTimestamp("test-page");
      expect(timestamp).toBe(secondAccess);
    });
  });

  describe("deleteAccessTimestamp", () => {
    it("should remove access timestamp", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const now = Date.now();
      
      await storage.setAccessTimestamp("test-page", now);
      await storage.deleteAccessTimestamp("test-page");
      const timestamp = await storage.getAccessTimestamp("test-page");
      
      expect(timestamp).toBeNull();
    });
  });

  describe("Key Prefixes", () => {
    it("should use correct prefix for access timestamps", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const now = Date.now();
      
      await storage.setAccessTimestamp("test", now);
      
      // Check that the key has the correct prefix
      const keys = Array.from(mockKV.store.keys());
      expect(keys).toContain("accessedts:test");
    });

    it("should not interfere with other data types", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const now = Date.now();
      
      // Use same slug for different data types
      await storage.setContent("shared", "<h1>Content</h1>");
      await storage.setMeta("shared", { description: "Meta" });
      await storage.setState("shared", { state: "data" });
      await storage.setAccessTimestamp("shared", now);
      
      const content = await storage.getContent("shared");
      const meta = await storage.getMeta("shared");
      const state = await storage.getState("shared");
      const timestamp = await storage.getAccessTimestamp("shared");
      
      expect(content).toBe("<h1>Content</h1>");
      expect(meta).toEqual({ description: "Meta" });
      expect(state).toEqual({ state: "data" });
      expect(timestamp).toBe(now);
    });
  });
});
