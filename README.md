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

## JSON Data Storage API

SpikeMe provides a referrer-scoped JSON storage API that allows client-side applications to store and retrieve JSON data based on the requesting page's URL. This is ideal for client-side state persistence, caching, or simple data storage without requiring database setup.

### Overview

The `/api/v1/json_data` endpoint provides KV-backed JSON storage where data is automatically scoped by:
- **Referrer URL**: Data is isolated by the `Referer` header (falls back to `Origin`, then `"unknown"`)
- **Path**: Optional path parameter for organizing data within a referrer scope

**Key Format**: `apiv1json:<referrer>:<path>`

**Example Keys**:
- From `Referer: https://example.com/page.html` with path `/user/settings` → `apiv1json:https://example.com/page.html:user/settings`
- From `Referer: https://app.com` with no path → `apiv1json:https://app.com:`

### API Endpoints

#### GET `/api/v1/json_data/{path?}`

Retrieve JSON data from storage.

**Response**:
- **200 OK**: Returns `{ "data": <stored_json> }` if data exists, or `{}` if not found
- **400 Bad Request**: Invalid path (e.g., contains `..`)
- **500 Internal Server Error**: KV read failure

**Example**:
```javascript
// Retrieve data
const response = await fetch('/api/v1/json_data/my/data');
const result = await response.json();
console.log(result.data || {}); // Stored data or empty object
```

#### POST `/api/v1/json_data/{path?}`

Store JSON data to storage.

**Request Body**: Valid JSON object to store

**Response**:
- **201 Created**: Returns `{ "status": "stored", "key": "<constructed_key>" }`
- **400 Bad Request**: Invalid JSON or invalid path
- **413 Payload Too Large**: Data exceeds 1 MB limit
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: KV write failure

**Example**:
```javascript
// Store data
const data = { key: 'value', nested: { data: 123 } };
const response = await fetch('/api/v1/json_data/my/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
const result = await response.json();
console.log(result); // { status: 'stored', key: 'apiv1json:...' }
```

### cURL Examples

```bash
# GET - Retrieve data (replace with actual Referer)
curl -H "Referer: https://example.com/page.html" \
  https://your-worker.workers.dev/api/v1/json_data/my/data

# POST - Store data
curl -X POST \
  -H "Referer: https://example.com/page.html" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello World","count":42}' \
  https://your-worker.workers.dev/api/v1/json_data/my/data
```

### Client-Side Usage

```html
<script>
// Simple client-side storage example
async function saveUserPreferences() {
  const prefs = { theme: 'dark', language: 'en' };
  const response = await fetch('/api/v1/json_data/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs)
  });
  const result = await response.json();
  console.log('Saved:', result.status); // 'stored'
}

async function loadUserPreferences() {
  const response = await fetch('/api/v1/json_data/preferences');
  const result = await response.json();
  return result.data || { theme: 'light', language: 'en' }; // Defaults if empty
}
</script>
```

### Features & Limitations

**Features**:
- Automatic referrer-based scoping (data isolated by originating page)
- Optional path segments for organizing data
- CORS enabled for cross-origin requests
- No authentication required (public endpoint)
- Data persists indefinitely (no automatic TTL)

**Limitations**:
- Maximum value size: 1 MB per key
- Maximum key size: 512 bytes
- KV rate limits apply (check Cloudflare KV documentation)
- Path validation: no `..` (directory traversal), leading/trailing slashes normalized
- Data is scoped per exact referrer URL (including path and domain)

### Use Cases

- **Client-side caching**: Cache API responses or computed data
- **User preferences**: Store theme, language, or UI settings
- **Form data**: Persist form progress across sessions
- **Simple state management**: Store application state without backend setup
- **Cross-tab communication**: Share data between tabs from same origin

**Note**: Since this is a public endpoint, do not store sensitive data. Consider adding authentication for production use cases requiring security.

## Storage Architecture

SpikeMe uses a unified KV namespace for simple and efficient data management:

- **SPIKEME namespace**: Single KV namespace using key prefixes for different data types:
  - `content:<slug>` - Page HTML content
  - `meta:<slug>` - Page metadata like title and description  
  - `state:<slug>` - Page state data for dynamic functionality

This unified approach reduces complexity and allows for easy addition of new data types without creating additional namespaces.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create the SPIKEME KV namespace and bind it in `wrangler.jsonc`:
   ```bash
   npx wrangler kv namespace create SPIKEME
   ```
   Add the generated ID to your `wrangler.jsonc` under the `SPIKEME` binding.
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
