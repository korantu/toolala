import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { createStorageManager } from "../lib/storage";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug;
  
  if (!slug) {
    return json({ error: "Slug is required" }, { status: 400 });
  }

  const storage = createStorageManager(context.cloudflare.env);
  
  try {
    const content = await storage.getContent(slug);
    
    if (!content) {
      return json({ error: "Page not found" }, { status: 404 });
    }
    
    return json({ content });
  } catch (error) {
    console.error("Failed to fetch page content:", error);
    return json({ error: "Failed to fetch page content" }, { status: 500 });
  }
}