import { type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { createStorageManager } from "../lib/storage";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug!;

  const storage = createStorageManager(context.cloudflare.env);
  const [content, meta] = await Promise.all([
    storage.getContent(slug),
    storage.getMeta(slug),
  ]);

  if (!content) {
    throw new Response("Not found", { status: 404 });
  }

  // Track page access asynchronously (don't await to avoid slowing down page load)
  context.cloudflare.ctx.waitUntil(
    storage.setAccessTimestamp(slug, Date.now())
  );

  const title = deriveTitle(meta ? JSON.stringify(meta) : null, slug);
  const body = isReactSnippet(content)
    ? buildReactDocument(content, title, slug)
    : content;

  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function isReactSnippet(html: string): boolean {
  const normalized = html.replace(/^\uFEFF/, ""); // drop UTF-8 BOM if present
  const [firstLine = ""] = normalized.trimStart().split(/\r?\n/, 1);
  return /\bReact\b/.test(firstLine);
}

export function buildReactDocument(source: string, title: string, slug?: string): string {
  const escapedTitle = escapeHtml(title);
  const preparedSource = normalizeReactSource(source);
  
  // PWA elements for React pages when slug is provided
  const manifestLink = slug ? `\n  <link rel="manifest" href="/${slug}/manifest.json">` : '';
  const serviceWorkerScript = slug ? `\n  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/${slug}/service-worker.js')
        .then(registration => console.log('SW registered'))
        .catch(error => console.log('SW registration failed'));
    }
  </script>` : '';
  
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta name="format-detection" content="telephone=no">\n  <meta name="mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-status-bar-style" content="default">\n  <meta name="theme-color" content="#ffffff">\n  <title>${escapedTitle}</title>${manifestLink}\n  <!-- Tailwind CSS from CDN -->\n  <script src="https://cdn.tailwindcss.com"></script>${serviceWorkerScript}\n</head>\n<body class="bg-gray-100">\n  <div id="root"></div>\n\n  <!-- React & ReactDOM from CDN -->\n  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>\n  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>\n  \n  <!-- Babel Standalone for JSX transpilation -->\n  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n\n  <script type="text/babel">\n${preparedSource}\n  </script>\n</body>\n</html>`;
}

function normalizeReactSource(source: string): string {
  let output = source.replace(/\r\n?/g, "\n");

  output = output.replace(/^[\t ]*import\s+React\s*,\s*\{\s*([^}]+)\s*\}\s+from\s+["']react["'];?\s*$/gm, (_, hooks) =>
    renderHookAssignments(hooks, "React"),
  );

  output = output.replace(/^[\t ]*import\s+\{\s*([^}]+)\s*\}\s+from\s+["']react["'];?\s*$/gm, (_, hooks) =>
    renderHookAssignments(hooks, "React"),
  );

  output = output.replace(/^[\t ]*import\s+React\s+from\s+["']react["'];?\s*$/gm, "");

  output = output.replace(/^[\t ]*import\s+ReactDOM\s*,\s*\{\s*([^}]+)\s*\}\s+from\s+["']react-dom["'];?\s*$/gm, (_, hooks) =>
    renderHookAssignments(hooks, "ReactDOM"),
  );

  output = output.replace(/^[\t ]*import\s+\{\s*([^}]+)\s*\}\s+from\s+["']react-dom["'];?\s*$/gm, (_, hooks) =>
    renderHookAssignments(hooks, "ReactDOM"),
  );

  output = output.replace(/^[\t ]*import\s+ReactDOM\s+from\s+["']react-dom["'];?\s*$/gm, "");

  output = ensureReactDomRender(output);

  output = output.replace(/\n{3,}/g, "\n\n");

  return output.trimStart();
}

function renderHookAssignments(hooks: string, namespace: "React" | "ReactDOM"): string {
  const assignments = hooks
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [name, alias] = token.split(/\s+as\s+/i).map((part) => part.trim());
      const local = alias ?? name;
      return `const ${local} = ${namespace}.${name};`;
    });
  return assignments.join("\n");
}

function ensureReactDomRender(source: string): string {
  if (/ReactDOM\.render\s*\(/.test(source)) {
    return source;
  }

  let componentName: string | undefined;

  const strip = (pattern: RegExp, replacer: (match: string, name: string) => string) => {
    source = source.replace(pattern, (match, name) => {
      componentName = componentName ?? name;
      return replacer(match, name);
    });
  };

  strip(/^[\t ]*export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/gm, (_match, name) => `function ${name}(`);
  strip(/^[\t ]*export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/gm, (_match, name) => `function ${name}(`);
  strip(/^[\t ]*export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*/gm, (_match, name) => `const ${name} = `);
  strip(/^[\t ]*export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?\s*$/gm, (_match, _name) => "");
  strip(/^[\t ]*export\s+\{\s*([A-Z][A-Za-z0-9_]*)\s*(?:as\s+[A-Z][A-Za-z0-9_]*)?\s*\}\s*;?\s*$/gm, (_match, _name) => "");

  if (!componentName) {
    const fallback = source.match(/^[\t ]*(?:const|function)\s+([A-Z][A-Za-z0-9_]*)/m);
    if (fallback) {
      componentName = fallback[1];
    }
  }

  if (!componentName) {
    return source;
  }

  const trimmed = source.trimEnd();
  const suffix = `\n\n// Render the component\nReactDOM.render(<${componentName} />, document.getElementById('root'));`;
  return `${trimmed}${suffix}`;
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
