import { describe, expect, it } from "vitest";
import { loader } from "../app/routes/migrate";

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
  };
};

const createMockContext = (spikemeKV?: any, contentKV?: any, metaKV?: any, stateKV?: any) => ({
  cloudflare: {
    env: {
      SPIKEME: spikemeKV,
      PAGE_CONTENT: contentKV,
      PAGE_META: metaKV,
      PAGE_STATE: stateKV,
    },
  },
} as any);

const createMockRequest = () => new Request("http://localhost/migrate");

describe("Migration Endpoint", () => {
  it("should return error when SPIKEME namespace is not configured", async () => {
    const context = createMockContext();
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any as any;

    expect(response.status).toBe(400);
    expect(data.error).toBe("SPIKEME namespace not configured");
  });

  it("should migrate content from PAGE_CONTENT to SPIKEME with content: prefix", async () => {
    const contentKV = createMockKV();
    const spikemeKV = createMockKV();
    
    // Setup test data in PAGE_CONTENT
    await contentKV.put("page1", "<h1>Page 1</h1>");
    await contentKV.put("page2", "<h1>Page 2</h1>");
    
    const context = createMockContext(spikemeKV, contentKV);
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.results.content.copied).toBe(2);
    expect(data.results.content.skipped).toBe(0);
    expect(data.results.content.failed).toBe(0);

    // Verify data was copied with correct prefixes
    expect(await spikemeKV.get("content:page1")).toBe("<h1>Page 1</h1>");
    expect(await spikemeKV.get("content:page2")).toBe("<h1>Page 2</h1>");
  });

  it("should migrate meta from PAGE_META to SPIKEME with meta: prefix", async () => {
    const metaKV = createMockKV();
    const spikemeKV = createMockKV();
    
    // Setup test data in PAGE_META
    await metaKV.put("page1", JSON.stringify({ description: "Page 1 desc" }));
    await metaKV.put("page2", JSON.stringify({ description: "Page 2 desc" }));
    
    const context = createMockContext(spikemeKV, undefined, metaKV);
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.results.meta.copied).toBe(2);
    expect(data.results.meta.skipped).toBe(0);
    expect(data.results.meta.failed).toBe(0);

    // Verify data was copied with correct prefixes
    expect(await spikemeKV.get("meta:page1")).toBe(JSON.stringify({ description: "Page 1 desc" }));
    expect(await spikemeKV.get("meta:page2")).toBe(JSON.stringify({ description: "Page 2 desc" }));
  });

  it("should migrate state from PAGE_STATE to SPIKEME with state: prefix", async () => {
    const stateKV = createMockKV();
    const spikemeKV = createMockKV();
    
    // Setup test data in PAGE_STATE
    await stateKV.put("page1", JSON.stringify({ counter: 1 }));
    await stateKV.put("page2", JSON.stringify({ counter: 2 }));
    
    const context = createMockContext(spikemeKV, undefined, undefined, stateKV);
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.results.state.copied).toBe(2);
    expect(data.results.state.skipped).toBe(0);
    expect(data.results.state.failed).toBe(0);

    // Verify data was copied with correct prefixes
    expect(await spikemeKV.get("state:page1")).toBe(JSON.stringify({ counter: 1 }));
    expect(await spikemeKV.get("state:page2")).toBe(JSON.stringify({ counter: 2 }));
  });

  it("should skip existing data (idempotent)", async () => {
    const contentKV = createMockKV();
    const spikemeKV = createMockKV();
    
    // Setup test data in both namespaces
    await contentKV.put("page1", "<h1>Page 1</h1>");
    await spikemeKV.put("content:page1", "<h1>Existing content</h1>"); // Already exists
    
    const context = createMockContext(spikemeKV, contentKV);
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.results.content.copied).toBe(0);
    expect(data.results.content.skipped).toBe(1);
    expect(data.results.content.failed).toBe(0);

    // Verify existing data was not overwritten
    expect(await spikemeKV.get("content:page1")).toBe("<h1>Existing content</h1>");
  });

  it("should migrate all three namespaces simultaneously", async () => {
    const contentKV = createMockKV();
    const metaKV = createMockKV();
    const stateKV = createMockKV();
    const spikemeKV = createMockKV();
    
    // Setup test data in all legacy namespaces
    await contentKV.put("page1", "<h1>Content 1</h1>");
    await metaKV.put("page1", JSON.stringify({ description: "Meta 1" }));
    await stateKV.put("page1", JSON.stringify({ state: "data1" }));
    
    await contentKV.put("page2", "<h1>Content 2</h1>");
    await metaKV.put("page2", JSON.stringify({ description: "Meta 2" }));
    
    const context = createMockContext(spikemeKV, contentKV, metaKV, stateKV);
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.summary.totalCopied).toBe(5); // 2 content + 2 meta + 1 state
    expect(data.summary.totalSkipped).toBe(0);
    expect(data.summary.totalFailed).toBe(0);

    // Verify all data was migrated with correct prefixes
    expect(await spikemeKV.get("content:page1")).toBe("<h1>Content 1</h1>");
    expect(await spikemeKV.get("content:page2")).toBe("<h1>Content 2</h1>");
    expect(await spikemeKV.get("meta:page1")).toBe(JSON.stringify({ description: "Meta 1" }));
    expect(await spikemeKV.get("meta:page2")).toBe(JSON.stringify({ description: "Meta 2" }));
    expect(await spikemeKV.get("state:page1")).toBe(JSON.stringify({ state: "data1" }));
  });

  it("should handle errors gracefully and continue migration", async () => {
    const contentKV = createMockKV();
    const spikemeKV = createMockKV(); 
    
    // Setup test data
    await contentKV.put("page1", "<h1>Page 1</h1>");
    await contentKV.put("page2", "<h1>Page 2</h1>");
    
    // Mock SPIKEME to fail on page2
    const originalPut = spikemeKV.put;
    spikemeKV.put = async (key: string, value: string) => {
      if (key === "content:page2") {
        throw new Error("Simulated error");
      }
      return originalPut.call(spikemeKV, key, value);
    };
    
    const context = createMockContext(spikemeKV, contentKV);
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.results.content.copied).toBe(1);
    expect(data.results.content.failed).toBe(1);
    expect(data.results.content.errors).toHaveLength(1);
    expect(data.results.content.errors[0]).toContain("Failed to migrate content key page2");

    // Verify partial migration
    expect(await spikemeKV.get("content:page1")).toBe("<h1>Page 1</h1>");
    expect(await spikemeKV.get("content:page2")).toBeNull();
  });

  it("should handle missing legacy namespaces gracefully", async () => {
    const spikemeKV = createMockKV();
    
    // Only provide SPIKEME, no legacy namespaces
    const context = createMockContext(spikemeKV);
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.summary.totalCopied).toBe(0);
    expect(data.summary.totalSkipped).toBe(0);
    expect(data.summary.totalFailed).toBe(0);
  });

  it("should provide detailed migration summary", async () => {
    const contentKV = createMockKV();
    const spikemeKV = createMockKV();
    
    await contentKV.put("page1", "<h1>Page 1</h1>");
    await spikemeKV.put("content:existing", "<h1>Already here</h1>");
    
    const context = createMockContext(spikemeKV, contentKV);
    const request = createMockRequest();

    const response = await loader({ context, request } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.message).toBe("Migration completed");
    expect(data.summary).toEqual({
      totalCopied: 1,
      totalSkipped: 0,
      totalFailed: 0,
    });
    expect(data.results.content).toEqual({
      copied: 1,
      skipped: 0,
      failed: 0,
      errors: [],
    });
  });
});