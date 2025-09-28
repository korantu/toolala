import { type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { createStorageManager } from "../lib/storage";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug!;

  const storage = createStorageManager(context.cloudflare.env);
  const meta = await storage.getMeta(slug);
  
  if (!meta) {
    throw new Response("Not found", { status: 404 });
  }

  const title = meta.title || meta.description || slug;
  const description = meta.description || `${title} - Progressive Web App`;

  const manifest = {
    name: title,
    short_name: title,
    description: description,
    start_url: `/${slug}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600"
    },
  });
}