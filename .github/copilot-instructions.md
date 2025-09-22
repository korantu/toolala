# SpikeMe - Cloudflare Workers Micro CMS

**ALWAYS follow these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

SpikeMe is a lightweight content management system built with Remix, TypeScript, and Cloudflare Workers. It allows authoring HTML pages and React components that are stored in Cloudflare KV and served instantly from edge routes.

## Working Effectively

### Bootstrap and Setup
- **Install dependencies**: `npm install --legacy-peer-deps` -- REQUIRED: The `--legacy-peer-deps` flag is needed due to Wrangler version conflicts. Takes 60-90 seconds.
- **Generate Worker binding types**: `npm run cf-typegen` -- Run this after any changes to `wrangler.jsonc` bindings. Takes 2-3 seconds.

### Build and Test Commands (NEVER CANCEL - Wait for completion)
- **TypeScript check**: `npm run typecheck` -- Takes 4 seconds. NEVER CANCEL.
- **ESLint**: `npm run lint` -- Takes 2 seconds. May show warnings (acceptable). NEVER CANCEL.
- **Production build**: `npm run build` -- Takes 5-6 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- **Unit tests**: `npm run test` -- Takes 3 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- **Pre-deployment check**: `npm run check` -- Runs typecheck + build + dry-run deploy. Takes 11 seconds total. NEVER CANCEL. Set timeout to 120+ seconds.

### Development Workflow
- **Development server**: `npm run dev` -- Starts Remix+Vite dev server on http://localhost:5173. Includes hot reload.
- **Preview mode**: `npm run preview` -- Builds production bundle and runs with Wrangler dev on http://localhost:8787. Takes 6 seconds to build + startup time.
- **Production deployment**: `npm run deploy` -- Deploys to Cloudflare Workers. Only use after `npm run check` passes.

## Validation

### ALWAYS run these commands after making changes:
1. `npm run typecheck` -- Must pass without errors
2. `npm run lint` -- May show warnings but should not error
3. `npm run build` -- Must complete successfully
4. `npm run test` -- All tests must pass

### Manual Testing Required
**CRITICAL**: After any code changes, ALWAYS manually test the application:

1. **Start development server**: `npm run dev`
2. **Test basic functionality**:
   - Navigate to http://localhost:5173
   - Click "Create New Page"
   - Create a simple HTML page with:
     - Slug: `test-page`
     - Description: `Test page`
     - Content: `<h1>Hello World</h1><p>Test content</p>`
   - Save and verify the page renders correctly
3. **Test React functionality**:
   - Create another page with React content starting with `import React` on the first line
   - Verify it processes and renders as a React component
4. **Verify dashboard shows created pages**

## Key Project Structure

### Critical Files and Directories
- `app/` -- Remix application code
  - `routes/_index.tsx` -- Admin dashboard (lists and creates pages)
  - `routes/$slug.tsx` -- Dynamic route handler for serving content pages
  - `root.tsx` -- Root layout component
- `server.ts` -- Cloudflare Worker entry point
- `load-context.ts` -- Wires Worker bindings into Remix loaders/actions
- `wrangler.jsonc` -- Cloudflare Workers configuration (includes KV namespace bindings)
- `test/` -- Test files using Vitest with Cloudflare worker pool
- `build/` -- Generated output (NEVER edit manually)
- `public/` -- Static assets

### Important Configuration
- **KV Namespaces**: `PAGE_CONTENT` and `PAGE_META` (defined in `wrangler.jsonc`)
- **TypeScript config**: `tsconfig.json` includes Worker types
- **ESLint**: Uses flat config format in `eslint.config.js`
- **Styling**: Tailwind CSS configured in `tailwind.config.ts`

## Known Issues and Workarounds

### Dependency Installation
- **ALWAYS use**: `npm install --legacy-peer-deps` due to Wrangler version conflicts
- **Windows-specific package removed**: `@rollup/rollup-win32-x64-msvc` has been removed from dependencies for Linux compatibility
- **Fixed server.ts**: Added missing `props: {}` to ExecutionContext for TypeScript compatibility

### Development Environment
- External CDN resources may be blocked in some environments (normal for React components)
- Wrangler dev shows warnings about `workers.cloudflare.com` connectivity (expected in sandbox environments)
- Font loading from Google Fonts may fail (cosmetic issue only)

## Common Tasks

### Creating Content
- **HTML pages**: Any content not starting with React imports on the first line
- **React components**: Content starting with `import React` or similar React references on the first line
- **Slug format**: URL-friendly identifiers (a-z, 0-9, -, _)

### Debugging
- **Check KV bindings**: Verify `wrangler.jsonc` has correct namespace IDs
- **TypeScript errors**: Run `npm run cf-typegen` to regenerate binding types
- **Build issues**: Ensure `build/` directory is in `.gitignore` and never manually edited

### Code Style
- **TypeScript required**: Prefer explicit types on exports and async interfaces
- **2-space indentation**: Follow existing code style
- **ESLint compliance**: Run `npm run lint` before committing
- **Import paths**: Use `~/` for app-relative imports

## Timing Expectations
- Dependency install: 60-90 seconds
- TypeScript check: 4 seconds
- Linting: 2 seconds  
- Build: 5-6 seconds
- Tests: 3 seconds
- Full check: 11 seconds
- Dev server startup: 3-5 seconds

**CRITICAL**: NEVER CANCEL builds or long-running commands. Set appropriate timeouts (60+ seconds for builds, 30+ seconds for tests) and wait for completion.