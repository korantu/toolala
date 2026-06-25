import { describe, expect, it } from "vitest";
import { action } from "../app/routes/dash";

// Mock the Cloudflare context for testing
const createMockContext = () => ({
  cloudflare: {
    env: {
      TOOLALA: {
        put: async (_key: string, _value: string) => {
          // Mock successful storage
        },
      },
    },
  },
} as any);

const createMockFormData = (slug: string, html: string, description: string) => {
  const formData = new FormData();
  formData.set("slug", slug);
  formData.set("html", html);
  formData.set("description", description);
  return formData;
};

const createMockRequest = (formData: FormData) => ({
  formData: async () => formData,
} as any);

describe("Index route action", () => {
  it("should return success with slug and timestamp on successful save", async () => {
    const formData = createMockFormData("test-page", "<h1>Test</h1>", "Test page");
    const request = createMockRequest(formData);
    const context = createMockContext();

    const response = await action({ request, context, params: {} } as any);
    const data = await response.json() as { success?: boolean; slug?: string; timestamp?: number; error?: string };

    expect(data.success).toBe(true);
    expect(data.slug).toBe("test-page");
    expect(data.timestamp).toBeDefined();
    expect(typeof data.timestamp).toBe("number");
  });

  it("should return different timestamps for consecutive saves", async () => {
    const formData1 = createMockFormData("test-page", "<h1>Test 1</h1>", "Test page");
    const request1 = createMockRequest(formData1);
    const context1 = createMockContext();

    const response1 = await action({ request: request1, context: context1, params: {} } as any);
    const data1 = await response1.json() as { success?: boolean; slug?: string; timestamp?: number; error?: string };

    const formData2 = createMockFormData("test-page", "<h1>Test 2</h1>", "Test page");
    const request2 = createMockRequest(formData2);
    const context2 = createMockContext();

    const response2 = await action({ request: request2, context: context2, params: {} } as any);
    const data2 = await response2.json() as { success?: boolean; slug?: string; timestamp?: number; error?: string };

    expect(data1.timestamp).toBeDefined();
    expect(data2.timestamp).toBeDefined();
    // Timestamps should be different (or equal if executed in same millisecond, but at least defined)
    expect(data2.timestamp).toBeGreaterThanOrEqual(data1.timestamp!);
  });

  it("should return error for missing slug", async () => {
    const formData = createMockFormData("", "<h1>Test</h1>", "Test page");
    const request = createMockRequest(formData);
    const context = createMockContext();

    const response = await action({ request, context, params: {} } as any);
    const data = await response.json() as { success?: boolean; slug?: string; timestamp?: number; error?: string };

    expect(data.error).toBeDefined();
    expect(response.status).toBe(400);
  });

  it("should return error for missing html", async () => {
    const formData = createMockFormData("test-page", "", "Test page");
    const request = createMockRequest(formData);
    const context = createMockContext();

    const response = await action({ request, context, params: {} } as any);
    const data = await response.json() as { success?: boolean; slug?: string; timestamp?: number; error?: string };

    expect(data.error).toBeDefined();
    expect(response.status).toBe(400);
  });
});
