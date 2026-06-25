# SpikeMe

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/korantu/toolala)

SpikeMe is a lightweight content dashboard for Cloudflare Workers. It lets you author small HTML or React pages, store them in KV, and serve them from edge routes such as `/about` or `/launch`.

## Key Features

- **Edge-hosted micro CMS:** Author raw HTML or React snippets and persist them to the unified `SPIKEME` KV namespace.
- **Known-slug editing:** Open `/dash`, enter a slug you already know, and create or edit that page. There is no page/repository listing or search UI.
- **Instant routing:** Every saved slug becomes a public route handled by `app/routes/$slug.tsx`.
- **React snippet support:** Content that starts with React imports or a Babel script tag is wrapped in a standalone React document.
- **JSON state APIs:** Pages can store JSON through per-page state routes and the referrer-scoped `/api/json` shortcut.
- **Worker-first tooling:** Remix, Vite, Wrangler, Bun, and Cloudflare KV are the primary development stack.

## API Surface

### Page Content

- `GET /api/content/:slug` returns `{ "content": "..." }` for an existing page.
- `POST /api/page/:slug` updates an existing page's content.
- `GET /:slug` serves a saved page as HTML.
- `GET /:slug/edit` redirects to `/dash?edit=:slug`.

`POST /api/page/:slug` accepts:

```json
{
  "content": "<h1>Updated content</h1>"
}
```

Responses:

- `200` `{ "success": true }`
- `400` invalid JSON or missing non-empty `content`
- `404` page does not exist
- `405` wrong method
- `500` storage failure

### Per-Page State

For any saved page at `/example`, these routes are available:

- `GET /example/data` returns stored JSON or `{}`
- `POST /example/data` stores the JSON request body
- `DELETE /example/data` removes stored state

Example:

```html
<script>
async function saveData() {
  await fetch("/my-page/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello" })
  });
}

async function loadData() {
  return await fetch("/my-page/data").then((response) => response.json());
}
</script>
```

### Referrer-Scoped JSON Storage

Use `GET` and `POST` with `/api/json/:path?` or `/api/v1/json_data/:path?`.

Data is scoped by `Referer`, falling back to `Origin`, then `"unknown"`. Values are stored in `SPIKEME` using keys like `apiv1json:<referrer>:<path>`.

```javascript
await fetch("/api/json/preferences", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ theme: "dark" })
});

const prefs = await fetch("/api/json/preferences").then((response) => response.json());
```

Limits:

- Maximum value size: 1 MB
- Maximum key size: 512 bytes
- Path values may not contain `..`
- Public endpoint; do not store sensitive data

## LLM Component Instructions

The dashboard can copy instructions for generating single-file React JSX components. Those generated components should use:

- React and Tailwind only, loaded by the saved page wrapper
- No TypeScript, external packages, or separate files
- `GET/POST /api/json{{OptionalSubpath}}` for shared JSON storage
- `localStorage` for silent local persistence
- Explicit Save/Load controls for API operations

Voice APIs are not available in this app.

## Storage Architecture

SpikeMe uses one Cloudflare KV namespace:

- `content:<slug>` stores page HTML or React source
- `meta:<slug>` stores page metadata
- `state:<slug>` stores per-page JSON state
- `ref:<slug>` stores an optional reference version
- `accessedts:<slug>` stores the last page access timestamp

## Getting Started

Install dependencies:

```bash
bun install
```

Create the `SPIKEME` KV namespace and bind it in `wrangler.jsonc`:

```bash
bunx wrangler kv namespace create SPIKEME
```

Generate Worker binding types whenever `wrangler.jsonc` bindings change:

```bash
bun run cf-typegen
```

Start local development:

```bash
bun run dev
```

Open `/dash`, enter a known slug, and save the page.

## Development Workflow

- `bun run lint` checks ESLint.
- `bun run typecheck` checks TypeScript.
- `bun run test` runs Vitest.
- `bun run build` emits the production Remix bundle into `build/`.
- `bun run preview` builds and starts Wrangler locally against the compiled output.
- `bun run check` runs typecheck, build, and a dry-run deploy.

## Deployment

Use the Deploy to Cloudflare button at the top of this README for one-click setup from the known GitHub repository URL.

For local deployment:

```bash
bun run check
bun run deploy
```

Deployments rely on `wrangler.jsonc`; keep binding changes and generated types in sync.
