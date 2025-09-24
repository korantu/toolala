# SpikeMe

SpikeMe is a lightweight content dashboard for Cloudflare Workers. It lets you author small HTML pages, store them in KV, and serve them instantly from edge routes such as `/about` or `/launch`. The root route (`/`) exposes a Remix-powered admin view where you can create, update, and preview pages without leaving the browser.

## Key Features
- **Edge-hosted micro CMS:** Author raw HTML along with a short description, and persist both to Cloudflare KV (`PAGE_CONTENT` + `PAGE_META`).
- **Instant routing:** Every saved slug becomes a public route handled by `app/routes/$slug.tsx`, returning the stored HTML with a `text/html` response.
- **React snippet support:** Begin content with a React import/identifier and the worker will wrap it in a standalone document, injecting the render call into `#root` automatically.
- **Admin dashboard:** `app/routes/_index.tsx` lists existing pages, surfaces quick links, and provides a form for editing/creating entries.
- **Page state management:** Each page can store and retrieve JSON data via `/slug/data` API endpoints for dynamic functionality.
- **Worker-first tooling:** Remix Vite dev server, Wrangler deploys, and type-safe load contexts keep the stack familiar for Cloudflare developers.

## Page State Management

SpikeMe includes a built-in API for pages to store and retrieve JSON state data. This enables dynamic functionality within static pages.

### API Endpoints

For any page at `/example/`, the following endpoints are available:

- **GET `/example/data`** - Retrieve stored JSON data for the page
- **POST `/example/data`** - Store JSON data for the page  
- **DELETE `/example/data`** - Remove stored data for the page

### Usage Example

```html
<script>
async function saveData() {
  const data = { message: 'Hello World!', timestamp: new Date().toISOString() };
  const response = await fetch('/my-page/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await response.json(); // { success: true }
}

async function loadData() {
  const response = await fetch('/my-page/data');
  const data = await response.json(); // Returns stored data or {}
}

async function deleteData() {
  const response = await fetch('/my-page/data', { method: 'DELETE' });
  const result = await response.json(); // { success: true }
}
</script>
```

State data is stored in the `PAGE_STATE` KV namespace and is isolated per page slug.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Provision three KV namespaces and bind them in `wrangler.jsonc`:
   ```bash
   npx wrangler kv namespace create PAGE_CONTENT
   npx wrangler kv namespace create PAGE_META
   npx wrangler kv namespace create PAGE_STATE
   ```
   Copy the generated IDs into the matching bindings. Replace the `placeholder_will_be_generated` ID for PAGE_STATE with the actual ID from the command output.
3. Generate Worker binding types whenever bindings change:
   ```bash
   npm run cf-typegen
   ```
4. Launch the local dev server:
   ```bash
   npm run dev
   ```
   This runs Remix on Vite with Wrangler’s dev proxy so route loaders/actions receive Worker bindings.

## Development Workflow
- `npm run lint` / `npm run typecheck` keep ESLint and TypeScript clean before committing.
- `npm run test` executes Vitest specs under `test/` using Cloudflare’s worker pool configuration.
- `npm run build` emits the production bundle into `build/`, which `server.ts` uses inside the worker runtime.
- `npm run preview` rebuilds and runs a Wrangler dev session against the compiled output for staging checks.

## Deployment
Run a dry-run deploy before shipping:
```bash
npm run check
```
If it passes, push the latest KV schema notes and publish with:
```bash
npm run deploy
```
Deployments rely on the bindings defined in `wrangler.jsonc`; ensure any new namespaces or secrets are committed alongside README updates.
