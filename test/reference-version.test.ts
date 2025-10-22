import { describe, expect, it } from "vitest";
import { action, loader } from "../app/routes/_index";

// Mock the Cloudflare context for testing
const createMockContext = (kvData: Map<string, string>) => ({
  cloudflare: {
    env: {
      SPIKEME: {
        get: async (key: string) => {
          return kvData.get(key) || null;
        },
        put: async (key: string, value: string) => {
          kvData.set(key, value);
        },
        delete: async (key: string) => {
          kvData.delete(key);
        },
        list: async ({ prefix }: { prefix: string }) => {
          const keys: { name: string }[] = [];
          kvData.forEach((_, key) => {
            if (key.startsWith(prefix)) {
              keys.push({ name: key });
            }
          });
          return { keys };
        },
      },
    },
  },
} as any);

describe("Reference version functionality", () => {
  it("should save content as reference", async () => {
    const kvData = new Map<string, string>();
    kvData.set("content:test-page", "<h1>Test</h1>");
    kvData.set("meta:test-page", JSON.stringify({ description: "Test" }));
    
    const context = createMockContext(kvData);
    const formData = new FormData();
    formData.append("actionType", "saveReference");
    formData.append("slug", "test-page");
    formData.append("html", "<h1>Test</h1>");
    formData.append("description", "Test");

    const request = {
      formData: async () => formData,
    } as any;

    const response = await action({ request, context, params: {} } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.message).toBe("Reference version saved!");
    expect(kvData.get("ref:test-page")).toBe("<h1>Test</h1>");
  });

  it("should restore content from reference", async () => {
    const kvData = new Map<string, string>();
    kvData.set("content:test-page", "<h1>Modified</h1>");
    kvData.set("ref:test-page", "<h1>Original</h1>");
    kvData.set("meta:test-page", JSON.stringify({ description: "Test" }));
    
    const context = createMockContext(kvData);
    const formData = new FormData();
    formData.append("actionType", "restoreReference");
    formData.append("slug", "test-page");
    formData.append("html", "<h1>Modified</h1>");
    formData.append("description", "Test");

    const request = {
      formData: async () => formData,
    } as any;

    const response = await action({ request, context, params: {} } as any);
    const data = await response.json() as any;

    expect(data.success).toBe(true);
    expect(data.message).toBe("Restored from reference!");
    expect(data.restoredContent).toBe("<h1>Original</h1>");
  });

  it("should return error when restoring without reference", async () => {
    const kvData = new Map<string, string>();
    kvData.set("content:test-page", "<h1>Test</h1>");
    kvData.set("meta:test-page", JSON.stringify({ description: "Test" }));
    
    const context = createMockContext(kvData);
    const formData = new FormData();
    formData.append("actionType", "restoreReference");
    formData.append("slug", "test-page");
    formData.append("html", "<h1>Test</h1>");
    formData.append("description", "Test");

    const request = {
      formData: async () => formData,
    } as any;

    const response = await action({ request, context, params: {} } as any);
    const data = await response.json() as any;

    expect(response.status).toBe(404);
    expect(data.error).toBe("No reference version found");
  });

  it("loader should indicate when reference exists", async () => {
    const kvData = new Map<string, string>();
    kvData.set("content:test-page", "<h1>Test</h1>");
    kvData.set("ref:test-page", "<h1>Reference</h1>");
    kvData.set("meta:test-page", JSON.stringify({ description: "Test" }));
    
    const context = createMockContext(kvData);
    const request = {
      url: "http://localhost/?edit=test-page",
    } as any;

    const response = await loader({ request, context, params: {} } as any);
    const data = await response.json();

    expect(data.edit.slug).toBe("test-page");
    expect(data.edit.hasReference).toBe(true);
    expect(data.edit.html).toBe("<h1>Test</h1>");
  });

  it("loader should indicate when reference does not exist", async () => {
    const kvData = new Map<string, string>();
    kvData.set("content:test-page", "<h1>Test</h1>");
    kvData.set("meta:test-page", JSON.stringify({ description: "Test" }));
    
    const context = createMockContext(kvData);
    const request = {
      url: "http://localhost/?edit=test-page",
    } as any;

    const response = await loader({ request, context, params: {} } as any);
    const data = await response.json();

    expect(data.edit.slug).toBe("test-page");
    expect(data.edit.hasReference).toBe(false);
  });
});
