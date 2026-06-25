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

describe("Unified Storage Manager", () => {
  describe("Content Operations", () => {
    it("should store and retrieve content with content: prefix", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const html = "<h1>Test Page</h1><p>Content here</p>";
      
      await storage.setContent("test-page", html);
      const retrieved = await storage.getContent("test-page");
      
      expect(retrieved).toBe(html);
      // Verify it was stored with the correct prefix
      expect(await mockKV.get("content:test-page")).toBe(html);
    });

    it("should return null for non-existent content", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const retrieved = await storage.getContent("nonexistent");
      
      expect(retrieved).toBeNull();
    });

    it("should delete content", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const html = "<h1>To Delete</h1>";
      
      await storage.setContent("delete-me", html);
      await storage.deleteContent("delete-me");
      const retrieved = await storage.getContent("delete-me");
      
      expect(retrieved).toBeNull();
    });

  });

  describe("Meta Operations", () => {
    it("should store and retrieve meta with meta: prefix", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const meta = { description: "Test description", title: "Test Title" };
      
      await storage.setMeta("test-page", meta);
      const retrieved = await storage.getMeta("test-page");
      
      expect(retrieved).toEqual(meta);
      // Verify it was stored with the correct prefix and JSON serialized
      expect(await mockKV.get("meta:test-page")).toBe(JSON.stringify(meta));
    });

    it("should return null for non-existent meta", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const retrieved = await storage.getMeta("nonexistent");
      
      expect(retrieved).toBeNull();
    });

    it("should handle invalid JSON in meta", async () => {
      const mockKV = createMockKV();
      await mockKV.put("meta:broken", "invalid json{");
      const storage = new UnifiedStorageManager(mockKV);
      
      const retrieved = await storage.getMeta("broken");
      
      expect(retrieved).toBeNull();
    });

    it("should delete meta", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const meta = { description: "To delete" };
      
      await storage.setMeta("delete-me", meta);
      await storage.deleteMeta("delete-me");
      const retrieved = await storage.getMeta("delete-me");
      
      expect(retrieved).toBeNull();
    });

  });

  describe("State Operations", () => {
    it("should store and retrieve state with state: prefix", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const state = { counter: 42, name: "Test" };
      
      await storage.setState("test-page", state);
      const retrieved = await storage.getState("test-page");
      
      expect(retrieved).toEqual(state);
      // Verify it was stored with the correct prefix and JSON serialized
      expect(await mockKV.get("state:test-page")).toBe(JSON.stringify(state));
    });

    it("should return null for non-existent state", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const retrieved = await storage.getState("nonexistent");
      
      expect(retrieved).toBeNull();
    });

    it("should handle invalid JSON in state", async () => {
      const mockKV = createMockKV();
      await mockKV.put("state:broken", "invalid json{");
      const storage = new UnifiedStorageManager(mockKV);
      
      const retrieved = await storage.getState("broken");
      
      expect(retrieved).toBeNull();
    });

    it("should delete state", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      const state = { toDelete: true };
      
      await storage.setState("delete-me", state);
      await storage.deleteState("delete-me");
      const retrieved = await storage.getState("delete-me");
      
      expect(retrieved).toBeNull();
    });

  });

  describe("Factory Function", () => {
    it("should create a UnifiedStorageManager when SPIKEME is provided", () => {
      const mockKV = createMockKV();
      const storage = createStorageManager({ SPIKEME: mockKV });
      
      expect(storage).toBeInstanceOf(UnifiedStorageManager);
    });
  });

  describe("Key Prefixes", () => {
    it("should use correct prefixes for all operations", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      
      await storage.setContent("test", "<h1>Test</h1>");
      await storage.setMeta("test", { description: "Test" });
      await storage.setState("test", { value: 123 });
      
      // Check that all keys have correct prefixes
      const keys = Array.from(mockKV.store.keys());
      expect(keys).toContain("content:test");
      expect(keys).toContain("meta:test");
      expect(keys).toContain("state:test");
      expect(keys).toHaveLength(3);
    });

    it("should not interfere between different data types", async () => {
      const mockKV = createMockKV();
      const storage = new UnifiedStorageManager(mockKV);
      
      // Use same slug for different data types
      await storage.setContent("shared", "<h1>Content</h1>");
      await storage.setMeta("shared", { description: "Meta" });
      await storage.setState("shared", { state: "data" });
      
      const content = await storage.getContent("shared");
      const meta = await storage.getMeta("shared");
      const state = await storage.getState("shared");
      
      expect(content).toBe("<h1>Content</h1>");
      expect(meta).toEqual({ description: "Meta" });
      expect(state).toEqual({ state: "data" });
    });
  });
});
