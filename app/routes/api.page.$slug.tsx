import { json, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { createStorageManager } from "../lib/storage";

export async function action({ params, context, request }: ActionFunctionArgs) {
  const slug = params.slug;

  if (!slug) {
    return json({ error: "Slug is required" }, { status: 400 });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const storage = createStorageManager(context.cloudflare.env);

  const existing = await storage.getContent(slug);
  if (!existing) {
    return json({ error: "Page not found" }, { status: 404 });
  }

  let content: string;
  try {
    const body = await request.json() as { content?: unknown };
    if (typeof body.content !== "string" || body.content.trim() === "") {
      return json({ error: "content field is required and must be a non-empty string" }, { status: 400 });
    }
    content = body.content;
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await storage.setContent(slug, content);
    return json({ success: true });
  } catch {
    return json({ error: "Failed to update page" }, { status: 500 });
  }
}
