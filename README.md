# SpikeMe

SpikeMe is a lightweight content dashboard for Cloudflare Workers. It lets you author small HTML pages, store them in KV, and serve them instantly from edge routes such as `/about` or `/launch`. The root route (`/`) exposes a Remix-powered admin view where you can create, update, and preview pages without leaving the browser.

## Key Features
- **Edge-hosted micro CMS:** Author raw HTML along with a short description, and persist both to Cloudflare KV (`PAGE_CONTENT` + `PAGE_META`).
- **Instant routing:** Every saved slug becomes a public route handled by `app/routes/$slug.tsx`, returning the stored HTML with a `text/html` response.
- **Admin dashboard:** `app/routes/_index.tsx` lists existing pages, surfaces quick links, and provides a form for editing/creating entries.
- **Worker-first tooling:** Remix Vite dev server, Wrangler deploys, and type-safe load contexts keep the stack familiar for Cloudflare developers.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Provision two KV namespaces and bind them in `wrangler.jsonc`:
   ```bash
   npx wrangler kv namespace create PAGE_CONTENT
   npx wrangler kv namespace create PAGE_META
   ```
   Copy the generated IDs into the matching bindings.
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
- `npm run test` executes Vitest specs (see `test/to-do-manager.test.ts`) using Cloudflare’s worker test pool.
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
