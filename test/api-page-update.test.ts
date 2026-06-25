import { describe, expect, it } from "vitest";
import { action } from "../app/routes/api.page.$slug";

const createMockContext = (existingContent: string | null, stored: { value?: string } = {}) => ({
  cloudflare: {
    env: {
      TOOLALA: {
        get: async (key: string) => {
          if (key.startsWith("content:") && existingContent !== null) {
            return existingContent;
          }
          return null;
        },
        put: async (_key: string, value: string) => {
          stored.value = value;
        },
      },
    },
  },
} as any);

const makeRequest = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/page/test-slug", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/page/:slug", () => {
  it("updates page content when page exists", async () => {
    const stored: { value?: string } = {};
    const context = createMockContext("<p>old</p>", stored);
    const request = makeRequest({ content: "<p>new</p>" });

    const response = await action({ params: { slug: "test-slug" }, context, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });
    expect(stored.value).toBe("<p>new</p>");
  });

  it("returns 404 when page does not exist", async () => {
    const context = createMockContext(null);
    const request = makeRequest({ content: "<p>new</p>" });

    const response = await action({ params: { slug: "missing" }, context, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: "Page not found" });
  });

  it("returns 400 for missing content field", async () => {
    const context = createMockContext("<p>old</p>");
    const request = makeRequest({});

    const response = await action({ params: { slug: "test-slug" }, context, request } as any);

    expect(response.status).toBe(400);
  });

  it("returns 400 for empty content", async () => {
    const context = createMockContext("<p>old</p>");
    const request = makeRequest({ content: "   " });

    const response = await action({ params: { slug: "test-slug" }, context, request } as any);

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const context = createMockContext("<p>old</p>");
    const request = new Request("http://localhost/api/page/test-slug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await action({ params: { slug: "test-slug" }, context, request } as any);

    expect(response.status).toBe(400);
  });

  it("returns 405 for non-POST methods", async () => {
    const context = createMockContext("<p>old</p>");
    const request = makeRequest({ content: "<p>new</p>" }, "PUT");

    const response = await action({ params: { slug: "test-slug" }, context, request } as any);

    expect(response.status).toBe(405);
  });

  it("returns 400 when slug is missing", async () => {
    const context = createMockContext("<p>old</p>");
    const request = makeRequest({ content: "<p>new</p>" });

    const response = await action({ params: {}, context, request } as any);

    expect(response.status).toBe(400);
  });
});
