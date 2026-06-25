import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { loader, action } from "../app/routes/api.json.$";

/**
 * Tests for the /api/json shortcut endpoint.
 * This should behave identically to /api/v1/json_data.
 */

// Mock KV storage
const createMockKV = () => {
  const storage = new Map<string, string>();
  
  return {
    storage,
    get: async (key: string) => {
      return storage.get(key) || null;
    },
    put: async (key: string, value: string) => {
      storage.set(key, value);
    },
    delete: async (key: string) => {
      storage.delete(key);
    },
  };
};

const createMockContext = (kv: any) => ({
  cloudflare: {
    env: {
      TOOLALA: kv,
    },
  },
} as any);

const createMockRequest = (options: {
  method?: string;
  referer?: string;
  origin?: string;
  body?: any;
} = {}) => {
  const headers = new Headers();
  if (options.referer) {
    headers.set("Referer", options.referer);
  }
  if (options.origin) {
    headers.set("Origin", options.origin);
  }
  headers.set("Content-Type", "application/json");

  return {
    method: options.method || "GET",
    headers,
    json: async () => options.body,
  } as any;
};

describe("JSON Shortcut API - GET requests", () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    kv = createMockKV();
  });

  it("should return empty object when key doesn't exist", async () => {
    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({ referer: "https://example.com/page" });

    const response = await loader({ params, context, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({});
  });

  it("should return stored data when key exists", async () => {
    const testData = { foo: "bar", num: 42 };
    const key = "apiv1json:https://example.com/page:";
    kv.storage.set(key, JSON.stringify(testData));

    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({ referer: "https://example.com/page" });

    const response = await loader({ params, context, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(testData);
  });

  it("should use path in key construction", async () => {
    const testData = { shortcut: "works" };
    const key = "apiv1json:https://example.com:some/path";
    kv.storage.set(key, JSON.stringify(testData));

    const params = { "*": "some/path" };
    const context = createMockContext(kv);
    const request = createMockRequest({ referer: "https://example.com" });

    const response = await loader({ params, context, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(testData);
  });

  it("should include CORS headers in response", async () => {
    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({ referer: "https://example.com" });

    const response = await loader({ params, context, request } as any);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("JSON Shortcut API - POST requests", () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    kv = createMockKV();
  });

  afterEach(() => {
    kv.storage.clear();
  });

  it("should store JSON data successfully", async () => {
    const testData = { shortcut: "post-test", num: 42 };
    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({
      method: "POST",
      referer: "https://example.com",
      body: testData,
    });

    const response = await action({ params, context, request } as any);

    expect(response.status).toBe(201);
    const data = await response.json() as any;
    expect(data).toHaveProperty("status", "stored");
    expect(data).toHaveProperty("key", "apiv1json:https://example.com:");

    // Verify data was stored
    const storedValue = kv.storage.get("apiv1json:https://example.com:");
    expect(storedValue).toBe(JSON.stringify(testData));
  });

  it("should store data with path in key", async () => {
    const testData = { path: "shortcut-data" };
    const params = { "*": "my/data" };
    const context = createMockContext(kv);
    const request = createMockRequest({
      method: "POST",
      referer: "https://example.com",
      body: testData,
    });

    const response = await action({ params, context, request } as any);

    expect(response.status).toBe(201);
    const data = await response.json() as any;
    expect(data.key).toBe("apiv1json:https://example.com:my/data");

    // Verify data was stored with correct key
    const storedValue = kv.storage.get("apiv1json:https://example.com:my/data");
    expect(storedValue).toBe(JSON.stringify(testData));
  });

  it("should include CORS headers in response", async () => {
    const testData = { test: "cors-shortcut" };
    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({
      method: "POST",
      referer: "https://example.com",
      body: testData,
    });

    const response = await action({ params, context, request } as any);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("JSON Shortcut API - Integration", () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    kv = createMockKV();
  });

  afterEach(() => {
    kv.storage.clear();
  });

  it("should support full write-read cycle through shortcut", async () => {
    const testData = { message: "Hello from shortcut!" };
    const params = { "*": "test/shortcut" };
    const context = createMockContext(kv);

    // POST data
    const postRequest = createMockRequest({
      method: "POST",
      referer: "https://app.example.com/page.html",
      body: testData,
    });

    const postResponse = await action({ params, context, request: postRequest } as any);
    expect(postResponse.status).toBe(201);

    // GET data
    const getRequest = createMockRequest({
      method: "GET",
      referer: "https://app.example.com/page.html",
    });

    const getResponse = await loader({ params, context, request: getRequest } as any);
    expect(getResponse.status).toBe(200);

    const retrievedData = await getResponse.json() as any;
    expect(retrievedData).toEqual(testData);
  });

  it("should share storage with /api/v1/json_data endpoint", async () => {
    // This test verifies that both endpoints use the same storage
    // Data stored via one endpoint should be retrievable via the other
    const testData = { shared: "storage-test" };
    const params = { "*": "shared/path" };
    const context = createMockContext(kv);

    // Store via shortcut endpoint
    const postRequest = createMockRequest({
      method: "POST",
      referer: "https://test.com",
      body: testData,
    });

    await action({ params, context, request: postRequest } as any);

    // The key should be the same format as the original endpoint
    const expectedKey = "apiv1json:https://test.com:shared/path";
    const storedValue = kv.storage.get(expectedKey);
    expect(storedValue).toBe(JSON.stringify(testData));

    // Verify we can retrieve it back
    const getRequest = createMockRequest({
      method: "GET",
      referer: "https://test.com",
    });

    const getResponse = await loader({ params, context, request: getRequest } as any);
    const retrievedData = await getResponse.json() as any;
    expect(retrievedData).toEqual(testData);
  });
});
