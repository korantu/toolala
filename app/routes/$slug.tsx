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
    : wrapHtmlWithDarkTheme(content, title);

  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function wrapHtmlWithDarkTheme(html: string, title: string): string {
  // Check if the HTML already has <!DOCTYPE html> or <html> tags
  const hasFullDocument = /<!DOCTYPE\s+html|<html[\s>]/i.test(html);
  
  if (hasFullDocument) {
    // If it's a full document, inject dark theme styles into the head
    let modifiedHtml = html;
    
    // Try to inject into <head> if it exists
    if (/<head[\s>]/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /(<head[^>]*>)/i,
        `$1\n  <style>body { background-color: #111827; color: #f3f4f6; } a { color: #60a5fa; }</style>`
      );
    } else {
      // No head tag, try to add after <html>
      modifiedHtml = modifiedHtml.replace(
        /(<html[^>]*>)/i,
        `$1\n<head>\n  <style>body { background-color: #111827; color: #f3f4f6; } a { color: #60a5fa; }</style>\n</head>`
      );
    }
    
    return modifiedHtml;
  } else {
    // It's a fragment, wrap it with a full HTML document
    const escapedTitle = escapeHtml(title);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#111827">
  <title>${escapedTitle}</title>
  <style>
    body {
      background-color: #111827;
      color: #f3f4f6;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1rem;
      line-height: 1.6;
    }
    a {
      color: #60a5fa;
    }
    a:hover {
      color: #93c5fd;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }
}

export function isReactSnippet(html: string): boolean {
  const normalized = html.replace(/^\uFEFF/, ""); // drop UTF-8 BOM if present
  const [firstLine = ""] = normalized.trimStart().split(/\r?\n/, 1);
  return /\bReact\b/.test(firstLine) || isBabelScriptTag(firstLine);
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
  
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta name="format-detection" content="telephone=no">\n  <meta name="mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-status-bar-style" content="default">\n  <meta name="theme-color" content="#111827">\n  <title>${escapedTitle}</title>${manifestLink}\n  <!-- Tailwind CSS from CDN -->\n  <script src="https://cdn.tailwindcss.com/3.4.17"></script>${serviceWorkerScript}\n</head>\n<body class="bg-gray-900 text-gray-100">\n  <div id="root"></div>\n\n  <!-- React & ReactDOM from CDN -->\n  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>\n  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>\n  \n  <!-- Babel Standalone for JSX transpilation -->\n  <script src="https://unpkg.com/@babel/standalone@7.29.7/babel.min.js"></script>\n\n  <script type="text/babel" data-presets="react">\n${preparedSource}\n  </script>\n</body>\n</html>`;
}

function normalizeReactSource(source: string): string {
  let output = unwrapBabelScript(source).replace(/\r\n?/g, "\n");

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

  output = output.replace(/^[\t ]*import\s+ReactDOM\s+from\s+["']react-dom\/client["'];?\s*$/gm, "const ReactDOM = window.ReactDOM;");

  output = output.replace(/^[\t ]*import\s+\{\s*([^}]+)\s*\}\s+from\s+["']react-dom\/client["'];?\s*$/gm, (_, hooks) =>
    renderHookAssignments(hooks, "ReactDOM"),
  );

  output = ensureReactDomRender(output);

  output = output.replace(/\n{3,}/g, "\n\n");

  return output.trimStart();
}

function isBabelScriptTag(line: string): boolean {
  return /<script\b(?=[^>]*\btype\s*=\s*["']text\/(?:babel|jsx)["'])[^>]*>/i.test(line);
}

function unwrapBabelScript(source: string): string {
  const normalized = source.replace(/^\uFEFF/, "").trim();
  const match = normalized.match(
    /^<script\b(?=[^>]*\btype\s*=\s*["']text\/(?:babel|jsx)["'])[^>]*>([\s\S]*)<\/script>\s*$/i,
  );

  return match ? match[1] : source;
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
  if (/ReactDOM\.render\s*\(|\bcreateRoot\b[\s\S]*?\.render\s*\(|ReactDOM\.createRoot\b[\s\S]*?\.render\s*\(/.test(source)) {
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
