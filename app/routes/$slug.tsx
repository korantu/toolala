import { type LoaderFunctionArgs } from "@remix-run/cloudflare";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug!;

  const [html, metaRaw] = await Promise.all([
    context.cloudflare.env.PAGE_CONTENT.get(slug),
    context.cloudflare.env.PAGE_META.get(slug),
  ]);

  if (!html) {
    throw new Response("Not found", { status: 404 });
  }

  const title = deriveTitle(metaRaw, slug);
  const body = isReactSnippet(html)
    ? buildReactDocument(html, title)
    : html;

  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function isReactSnippet(html: string): boolean {
  const [firstLine = ""] = html.split(/\r?\n/, 1);
  return firstLine.includes("React");
}

export function buildReactDocument(source: string, title: string): string {
  const escapedTitle = escapeHtml(title);
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${escapedTitle}</title>\n  <!-- Tailwind CSS from CDN -->\n  <script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body class="bg-gray-100">\n  <div id="root"></div>\n\n  <!-- React & ReactDOM from CDN -->\n  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>\n  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>\n  \n  <!-- Babel Standalone for JSX transpilation -->\n  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n\n  <script type="text/babel">\n${source}\n  </script>\n</body>\n</html>`;
}

function deriveTitle(metaRaw: string | null, slug: string): string {
  if (!metaRaw) return slug;
  try {
    const meta = JSON.parse(metaRaw) as { title?: string; description?: string } | undefined;
    return meta?.title?.trim() || meta?.description?.trim() || slug;
  } catch {
    return slug;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
