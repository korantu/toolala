# SpikeMe

SpikeMe is a lightweight content dashboard for Cloudflare Workers. It lets you author small HTML pages, store them in KV, and serve them instantly from edge routes such as `/about` or `/launch`. The root route (`/`) exposes a Remix-powered admin view where you can create, update, and preview pages without leaving the browser.

## Key Features
- **Edge-hosted micro CMS:** Author raw HTML along with a short description, and persist both to Cloudflare KV using the unified `SPIKEME` namespace with key prefixes.
- **Instant routing:** Every saved slug becomes a public route handled by `app/routes/$slug.tsx`, returning the stored HTML with a `text/html` response.
- **React snippet support:** Begin content with a React import/identifier and the worker will wrap it in a standalone document, injecting the render call into `#root` automatically.
- **Admin dashboard:** `app/routes/_index.tsx` lists existing pages, surfaces quick links, and provides a form for editing/creating entries.
- **Page state management:** Each page can store and retrieve JSON data via `/slug/data` API endpoints for dynamic functionality.
- **Worker-first tooling:** Remix Vite dev server, Wrangler deploys, and type-safe load contexts keep the stack familiar for Cloudflare developers.
- **Unified storage:** Uses a single `SPIKEME` KV namespace with key prefixes (`content:`, `meta:`, `state:`) for simplified management and future extensibility.

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

State data is stored in the unified `SPIKEME` KV namespace with the `state:` prefix and is isolated per page slug.

## Storage Architecture

SpikeMe uses a unified KV namespace approach for better organization and scalability:

- **SPIKEME namespace:** Single KV namespace using key prefixes for different data types:
  - `content:<slug>` - Page HTML content (replaces `PAGE_CONTENT`)
  - `meta:<slug>` - Page metadata like title and description (replaces `PAGE_META`)  
  - `state:<slug>` - Page state data for dynamic functionality (replaces `PAGE_STATE`)

This unified approach reduces complexity and allows for easy addition of new data types without creating additional namespaces.

### Migration from Legacy Namespaces

If upgrading from an existing installation with separate namespaces, visit `/migrate` to automatically copy all data from the legacy `PAGE_CONTENT`, `PAGE_META`, and `PAGE_STATE` namespaces to the new unified `SPIKEME` namespace with appropriate prefixes. The migration is idempotent and safe to run multiple times.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create the unified KV namespace and bind it in `wrangler.jsonc`:
   ```bash
   npx wrangler kv namespace create SPIKEME
   ```
   Add the generated ID to your `wrangler.jsonc` under the `SPIKEME` binding.

   **For legacy installations:** Keep your existing `PAGE_CONTENT`, `PAGE_META`, and `PAGE_STATE` namespaces for now - they will be used for migration and as fallbacks until you migrate the data.
3. Generate Worker binding types whenever bindings change:
   ```bash
   npm run cf-typegen
   ```
4. Launch the local dev server:
   ```bash
   npm run dev
   ```
   This runs Remix on Vite with Wrangler’s dev proxy so route loaders/actions receive Worker bindings.
5. **Migration (if upgrading):** Visit `/migrate` in your browser to automatically migrate existing data from legacy namespaces to the new unified `SPIKEME` namespace.

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
