import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { loader, action } from "../app/routes/api.v1.json_data.$";

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

describe("JSON Data API - GET requests", () => {
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
    const testData = { path: "test" };
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

  it("should fallback to Origin header when Referer is missing", async () => {
    const testData = { origin: "test" };
    const key = "apiv1json:https://origin.com:";
    kv.storage.set(key, JSON.stringify(testData));

    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({ origin: "https://origin.com" });

    const response = await loader({ params, context, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(testData);
  });

  it("should use 'unknown' when both Referer and Origin are missing", async () => {
    const testData = { unknown: "test" };
    const key = "apiv1json:unknown:";
    kv.storage.set(key, JSON.stringify(testData));

    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({});

    const response = await loader({ params, context, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(testData);
  });

  it("should normalize path by removing leading/trailing slashes", async () => {
    const testData = { normalized: "path" };
    const key = "apiv1json:https://example.com:test/path";
    kv.storage.set(key, JSON.stringify(testData));

    const params = { "*": "/test/path/" };
    const context = createMockContext(kv);
    const request = createMockRequest({ referer: "https://example.com" });

    const response = await loader({ params, context, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(testData);
  });

  it("should reject path with directory traversal", async () => {
    const params = { "*": "../secret" };
    const context = createMockContext(kv);
    const request = createMockRequest({ referer: "https://example.com" });

    const response = await loader({ params, context, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("directory traversal");
  });

  it("should reject URL-encoded directory traversal", async () => {
    // Test with %2E%2E (encoded ..)
    const params = { "*": "%2E%2E/secret" };
    const context = createMockContext(kv);
    const request = createMockRequest({ referer: "https://example.com" });

    const response = await loader({ params, context, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toContain("directory traversal");
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

describe("JSON Data API - POST requests", () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    kv = createMockKV();
  });

  afterEach(() => {
    kv.storage.clear();
  });

  it("should store JSON data successfully", async () => {
    const testData = { foo: "bar", num: 42 };
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
    const testData = { path: "data" };
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

  it("should reject invalid JSON", async () => {
    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = {
      method: "POST",
      headers: new Headers({ "Referer": "https://example.com" }),
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as any;

    const response = await action({ params, context, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toContain("Invalid JSON");
  });

  it("should reject path with directory traversal", async () => {
    const testData = { test: "data" };
    const params = { "*": "../secret" };
    const context = createMockContext(kv);
    const request = createMockRequest({
      method: "POST",
      referer: "https://example.com",
      body: testData,
    });

    const response = await action({ params, context, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toContain("directory traversal");
  });

  it("should reject oversized data (>1MB)", async () => {
    // Create a large object that exceeds 1MB when serialized
    // Start with a rough estimate, then calculate actual size needed
    const testObject = { data: "x" };
    const baseOverhead = new TextEncoder().encode(JSON.stringify(testObject)).length - 1; // Subtract the single "x"
    const targetSize = 1024 * 1024 + 100; // Target: 1MB + 100 bytes to ensure we exceed limit
    const stringLength = targetSize - baseOverhead;
    
    const largeData = { data: "x".repeat(stringLength) };
    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({
      method: "POST",
      referer: "https://example.com",
      body: largeData,
    });

    const response = await action({ params, context, request } as any);

    expect(response.status).toBe(413);
    const data = await response.json() as any;
    expect(data.error).toContain("exceeds 1 MB limit");
  });

  it("should overwrite existing data", async () => {
    const initialData = { version: 1 };
    const updatedData = { version: 2 };
    const key = "apiv1json:https://example.com:";

    // Store initial data
    kv.storage.set(key, JSON.stringify(initialData));

    const params = { "*": "" };
    const context = createMockContext(kv);
    const request = createMockRequest({
      method: "POST",
      referer: "https://example.com",
      body: updatedData,
    });

    const response = await action({ params, context, request } as any);

    expect(response.status).toBe(201);

    // Verify data was updated
    const storedValue = kv.storage.get(key);
    expect(JSON.parse(storedValue!)).toEqual(updatedData);
  });

  it("should include CORS headers in response", async () => {
    const testData = { test: "cors" };
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

  it("should handle complex nested JSON", async () => {
    const complexData = {
      user: { name: "John", age: 30 },
      items: [1, 2, 3, { nested: true }],
      metadata: { timestamp: Date.now() },
    };
    const params = { "*": "complex" };
    const context = createMockContext(kv);
    const request = createMockRequest({
      method: "POST",
      referer: "https://example.com",
      body: complexData,
    });

    const response = await action({ params, context, request } as any);

    expect(response.status).toBe(201);

    // Verify complex data was stored correctly
    const storedValue = kv.storage.get("apiv1json:https://example.com:complex");
    expect(JSON.parse(storedValue!)).toEqual(complexData);
  });
});

describe("JSON Data API - Integration", () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    kv = createMockKV();
  });

  afterEach(() => {
    kv.storage.clear();
  });

  it("should support full write-read cycle", async () => {
    const testData = { message: "Hello, World!" };
    const params = { "*": "test/integration" };
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

  it("should isolate data by referrer", async () => {
    const data1 = { referrer: "one" };
    const data2 = { referrer: "two" };
    const params = { "*": "isolated" };
    const context = createMockContext(kv);

    // Store data from first referrer
    const post1 = createMockRequest({
      method: "POST",
      referer: "https://site1.com",
      body: data1,
    });
    await action({ params, context, request: post1 } as any);

    // Store data from second referrer
    const post2 = createMockRequest({
      method: "POST",
      referer: "https://site2.com",
      body: data2,
    });
    await action({ params, context, request: post2 } as any);

    // Retrieve from first referrer
    const get1 = createMockRequest({
      method: "GET",
      referer: "https://site1.com",
    });
    const response1 = await loader({ params, context, request: get1 } as any);
    const retrieved1 = await response1.json() as any;
    expect(retrieved1).toEqual(data1);

    // Retrieve from second referrer
    const get2 = createMockRequest({
      method: "GET",
      referer: "https://site2.com",
    });
    const response2 = await loader({ params, context, request: get2 } as any);
    const retrieved2 = await response2.json() as any;
    expect(retrieved2).toEqual(data2);
  });

  it("should isolate data by path", async () => {
    const dataPath1 = { path: "path1" };
    const dataPath2 = { path: "path2" };
    const context = createMockContext(kv);
    const referer = "https://example.com";

    // Store data at path1
    const post1 = createMockRequest({
      method: "POST",
      referer,
      body: dataPath1,
    });
    await action({ params: { "*": "path1" }, context, request: post1 } as any);

    // Store data at path2
    const post2 = createMockRequest({
      method: "POST",
      referer,
      body: dataPath2,
    });
    await action({ params: { "*": "path2" }, context, request: post2 } as any);

    // Retrieve from path1
    const get1 = createMockRequest({ referer });
    const response1 = await loader({ params: { "*": "path1" }, context, request: get1 } as any);
    const retrieved1 = await response1.json() as any;
    expect(retrieved1).toEqual(dataPath1);

    // Retrieve from path2
    const get2 = createMockRequest({ referer });
    const response2 = await loader({ params: { "*": "path2" }, context, request: get2 } as any);
    const retrieved2 = await response2.json() as any;
    expect(retrieved2).toEqual(dataPath2);
  });
});
