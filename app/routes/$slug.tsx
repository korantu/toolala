import { type LoaderFunctionArgs } from "@remix-run/cloudflare";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug!;
  const html = await context.cloudflare.env.PAGE_CONTENT.get(slug);
  if (!html) {
    throw new Response("Not found", { status: 404 });
  }

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
