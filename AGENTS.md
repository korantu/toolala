# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains Remix route modules (`routes/_index.tsx`, `routes/$slug.tsx`), shared UI (`root.tsx`), and entrypoints for the Worker runtime.
- `server.ts` bootstraps the Cloudflare Worker with the Remix request handler; `load-context.ts` wires Worker bindings into Remix loaders/actions.
- `public/` holds static assets (e.g. `favicon.svg`), and `build/` is generated output—never edit by hand.
- Tests live in `test/` with a Vitest worker pool setup (`env.ts`, `*.test.ts`).

## Build, Test, and Development Commands
- `npm run dev` launches Vite+Remix with Wrangler’s dev proxy for local iteration.
- `npm run build` emits the production Remix build consumed by `server.ts`.
- `npm run preview` rebuilds then starts Wrangler in preview mode against the compiled bundle.
- `npm run lint` and `npm run typecheck` ensure ESLint and TypeScript pass before pushing.
- `npm run check` performs a dry-run deploy after compiling; use before opening a PR.

## Coding Style & Naming Conventions
- TypeScript is required; prefer explicit types on exports and async interfaces touching KV.
- Follow the existing 2-space indentation, double quotes for strings, and named exports for route loaders/actions.
- Tailwind classes belong in JSX `className`; share reusable logic via plain functions or classes in `app/`.
- Run `npm run lint` after edits—ESLint rules (typescript-eslint) and the `.gitignore` aware cache keep feedback fast.

## Testing Guidelines
- Write unit tests beside existing specs in `test/`, using `*.test.ts` naming.
- Import Cloudflare bindings from `cloudflare:test` (see `test/env.ts`) to exercise KV behavior.
- Stub network calls with Vitest mocks; clean up KV keys in `afterEach` to keep tests isolated.
- Include regression cases for each new worker route or mutation method before requesting review.

## Commit & Pull Request Guidelines
- Match the concise, imperative log style visible in `git log` (e.g. `fix namespace lookup`, `add kv healthcheck`).
- Keep commits focused; run lint, typecheck, and tests prior to each commit.
- PRs should describe the change, note worker bindings touched, and link relevant Cloudflare issue/Asana ticket.
- Add screenshots or curl examples when UI output or Worker responses change.

## Cloudflare Deployment Notes
- Wrangler settings live in `wrangler.jsonc`; update binding names in both `wrangler.jsonc` and `load-context.ts`.
- Generate updated binding types with `npm run cf-typegen` whenever secrets or KV namespaces change.
- Use `npm run deploy` only after `npm run check` succeeds and KV migrations are documented.
