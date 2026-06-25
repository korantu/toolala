import { describe, expect, it, beforeEach } from "vitest";
import { loader } from "../app/routes/api.content.$slug";

// Mock the Cloudflare context for testing
const createMockContext = (content: string | null) => ({
  cloudflare: {
    env: {
      TOOLALA: {
        get: async (key: string) => {
          if (key.startsWith("content:") && content !== null) {
            return content;
          }
          return null;
        },
      },
    },
  },
} as any);

const createMockRequest = () => ({
  url: "http://localhost/api/content/test-slug",
});

describe("API Content route loader", () => {
  it("should return page content when page exists", async () => {
    const testContent = "<h1>Test Page</h1><p>Test content</p>";
    const params = { slug: "test-slug" };
    const context = createMockContext(testContent);
    const request = createMockRequest();
    
    const response = await loader({ params, context, request } as any);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ content: testContent });
  });

  it("should return 404 when page does not exist", async () => {
    const params = { slug: "non-existent-slug" };
    const context = createMockContext(null);
    const request = createMockRequest();
    
    const response = await loader({ params, context, request } as any);
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: "Page not found" });
  });

  it("should return 400 when slug is missing", async () => {
    const params = {};
    const context = createMockContext("<h1>Test</h1>");
    const request = createMockRequest();
    
    const response = await loader({ params, context, request } as any);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Slug is required" });
  });

  it("should handle React component content", async () => {
    const reactContent = "import React from 'react';\n\nfunction App() {\n  return <div>Hello World</div>;\n}";
    const params = { slug: "react-page" };
    const context = createMockContext(reactContent);
    const request = createMockRequest();
    
    const response = await loader({ params, context, request } as any);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ content: reactContent });
  });
});