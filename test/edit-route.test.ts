import { describe, expect, it } from "vitest";
import { loader } from "../app/routes/$slug.edit";

// Mock the Cloudflare context for testing
const createMockContext = (pageExists: boolean) => ({
  cloudflare: {
    env: {
      SPIKEME: {
        get: async (key: string) => {
          if (key.startsWith("content:") && pageExists) {
            return "<h1>Test Content</h1>";
          }
          return null;
        },
      },
    },
  },
} as any);

const createMockRequest = (slug: string) => ({
  url: `http://localhost/${slug}/edit`,
});

describe("Edit route loader", () => {
  it("should redirect to edit mode for existing page", async () => {
    const params = { slug: "test-page" };
    const context = createMockContext(true);
    const request = createMockRequest("test-page");
    
    const response = await loader({ params, context, request } as any);
    
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/?edit=test-page");
  });

  it("should redirect to edit mode for non-existent page", async () => {
    const params = { slug: "nonexistent-page" };
    const context = createMockContext(false);
    const request = createMockRequest("nonexistent-page");
    
    const response = await loader({ params, context, request } as any);
    
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/?edit=nonexistent-page");
  });

  it("should handle special characters in slug", async () => {
    const params = { slug: "my-test-page_123" };
    const context = createMockContext(false);
    const request = createMockRequest("my-test-page_123");
    
    const response = await loader({ params, context, request } as any);
    
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/?edit=my-test-page_123");
  });
});