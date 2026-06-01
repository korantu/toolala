import { redirect, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { createStorageManager } from "../lib/storage";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug!;

  // Check if the page exists before redirecting to edit
  const storage = createStorageManager(context.cloudflare.env);
  const html = await storage.getContent(slug);
  
  if (!html) {
    // If page doesn't exist, redirect to home with the slug to create new page
    return redirect(`/dash?edit=${slug}`);
  }

  // Page exists, redirect to edit mode
  return redirect(`/dash?edit=${slug}`);
}