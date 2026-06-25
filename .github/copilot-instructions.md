# SpikeMe - Cloudflare Workers Micro CMS

Follow these instructions first and fall back to search or shell commands only when local facts differ.

SpikeMe is a lightweight content dashboard built with Remix, TypeScript, Bun, and Cloudflare Workers. It stores HTML pages and React snippets in Cloudflare KV and serves them instantly from edge routes.

## Working Effectively

### Bootstrap and Setup

- Install dependencies: `bun install`
- Generate Worker binding types after `wrangler.jsonc` binding changes: `bun run cf-typegen`

### Build and Test Commands

- TypeScript check: `bun run typecheck`
- ESLint: `bun run lint`
- Production build: `bun run build`
- Unit tests: `bun run test`
- Pre-deployment check: `bun run check`
- Production deployment: `bun run deploy`

Set timeouts generously and wait for completion.

### Development Workflow

- Development server: `bun run dev`
- Preview mode: `bun run preview`
- Dashboard: `/dash`
- Direct edit URL: `/dash?edit=<slug>`
- Public page URL: `/<slug>`

The dashboard intentionally has no page/repository listing or search. Users must know the slug or URL they want to edit.

## Validation

After code changes, run:

1. `bun run typecheck`
2. `bun run lint`
3. `bun run build`
4. `bun run test`

Manual smoke test:

1. Start `bun run dev`.
2. Open `/dash`.
3. Enter a slug such as `test-page`.
4. Save HTML content and verify `/<slug>` renders.
5. Save a React snippet and verify the generated page renders.

## Key Project Structure

- `app/routes/dash.tsx` - direct slug dashboard and editor
- `app/routes/$slug.tsx` - dynamic page renderer
- `app/routes/$slug.data.tsx` - per-page state API
- `app/routes/api.page.$slug.tsx` - page update API
- `app/routes/api.content.$slug.tsx` - page content API
- `app/routes/api.v1.json_data.$.tsx` - referrer-scoped JSON API
- `app/lib/storage.ts` - unified KV storage manager
- `server.ts` - Cloudflare Worker entry point
- `load-context.ts` - Worker bindings for Remix loaders/actions
- `wrangler.jsonc` - Worker configuration and KV binding
- `test/` - Vitest tests using Cloudflare worker pool

## Important Configuration

- KV namespace: `SPIKEME`
- Key prefixes: `content:`, `meta:`, `state:`, `ref:`, `accessedts:`
- Voice APIs are not part of this app.
- Use `bunx wrangler` for direct Wrangler commands.

## Code Style

- TypeScript required.
- Use 2-space indentation and double quotes.
- Prefer named exports for loaders/actions.
- Use Tailwind classes in JSX.
- Keep generated `build/` output unedited.
