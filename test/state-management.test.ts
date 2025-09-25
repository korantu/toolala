import { describe, expect, it } from "vitest";
import { createStateManager } from "../app/lib/state";
import { loader, action } from "../app/routes/$slug.data";

// Mock KV namespace for testing
const createMockKV = (): any => {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) || null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
  };
};

// Mock context for testing
const createMockContext = () => ({
  cloudflare: {
    env: {
      SPIKEME: createMockKV(),
    },
  },
} as any);

const createMockRequest = (method: string, body?: any) => {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request("http://localhost/test/data", init);
};

describe("State Management", () => {

  describe("StateManager", () => {
    it("should store and retrieve JSON data", async () => {
      const mockKV = createMockKV();
      const stateManager = createStateManager({ SPIKEME: mockKV });
      const testData = { message: "Hello, World!", count: 42 };
      
      await stateManager.set("test-page", testData);
      const retrieved = await stateManager.get("test-page");
      
      expect(retrieved).toEqual(testData);
    });

    it("should return null for non-existent data", async () => {
      const mockKV = createMockKV();
      const stateManager = createStateManager({ SPIKEME: mockKV });
      const retrieved = await stateManager.get("nonexistent-page");
      
      expect(retrieved).toBeNull();
    });

    it("should delete data", async () => {
      const mockKV = createMockKV();
      const stateManager = createStateManager({ SPIKEME: mockKV });
      const testData = { test: true };
      
      await stateManager.set("test-page", testData);
      await stateManager.delete("test-page");
      const retrieved = await stateManager.get("test-page");
      
      expect(retrieved).toBeNull();
    });
  });

  describe("Data Route", () => {
    it("should handle GET requests", async () => {
      const params = { slug: "test-page" };
      const mockKV = createMockKV();
      const context = { cloudflare: { env: { SPIKEME: mockKV } } };
      const request = createMockRequest("GET");
      
      // First, store some data
      const stateManager = createStateManager({ SPIKEME: mockKV });
      await stateManager.set("test-page", { greeting: "Hello" });
      
      const response = await loader({ params, context, request } as any);
      const data = await response.json();
      
      expect(data).toEqual({ greeting: "Hello" });
    });

    it("should return empty object for non-existent data", async () => {
      const params = { slug: "nonexistent-page" };
      const context = createMockContext();
      const request = createMockRequest("GET");
      
      const response = await loader({ params, context, request } as any);
      const data = await response.json();
      
      expect(data).toEqual({});
    });

    it("should handle POST requests", async () => {
      const params = { slug: "test-page" };
      const mockKV = createMockKV();
      const context = { cloudflare: { env: { SPIKEME: mockKV } } };
      const testData = { name: "Test", value: 123 };
      const request = createMockRequest("POST", testData);
      
      const response = await action({ params, context, request } as any);
      const result = await response.json();
      
      expect(result).toEqual({ success: true });
      
      // Verify data was stored
      const stateManager = createStateManager({ SPIKEME: mockKV });
      const stored = await stateManager.get("test-page");
      expect(stored).toEqual(testData);
    });

    it("should handle DELETE requests", async () => {
      const params = { slug: "test-page" };
      const mockKV = createMockKV();
      const context = { cloudflare: { env: { SPIKEME: mockKV } } };
      
      // First, store some data
      const stateManager = createStateManager({ SPIKEME: mockKV });
      await stateManager.set("test-page", { toDelete: true });
      
      const request = createMockRequest("DELETE");
      const response = await action({ params, context, request } as any);
      const result = await response.json();
      
      expect(result).toEqual({ success: true });
      
      // Verify data was deleted
      const stored = await stateManager.get("test-page");
      expect(stored).toBeNull();
    });

    it("should return 405 for unsupported methods", async () => {
      const params = { slug: "test-page" };
      const context = createMockContext();
      const request = createMockRequest("PUT");
      
      const response = await action({ params, context, request } as any);
      expect(response.status).toBe(405);
      
      const result = await response.json();
      expect(result).toEqual({ error: "Method not allowed" });
    });
  });
});