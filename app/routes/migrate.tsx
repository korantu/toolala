import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";

export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;

  // Check if SPIKEME namespace is available
  if (!env.SPIKEME) {
    return json({ error: "SPIKEME namespace not configured" }, { status: 400 });
  }

  const results = {
    content: { copied: 0, skipped: 0, failed: 0, errors: [] as string[] },
    meta: { copied: 0, skipped: 0, failed: 0, errors: [] as string[] },
    state: { copied: 0, skipped: 0, failed: 0, errors: [] as string[] },
  };

  try {
    // Migrate PAGE_CONTENT to SPIKEME with content: prefix
    if (env.PAGE_CONTENT) {
      const contentList = await env.PAGE_CONTENT.list({ limit: 1000 });
      for (const key of contentList.keys) {
        try {
          const targetKey = `content:${key.name}`;
          const existing = await env.SPIKEME.get(targetKey);
          
          if (existing) {
            results.content.skipped++;
          } else {
            const value = await env.PAGE_CONTENT.get(key.name);
            if (value) {
              await env.SPIKEME.put(targetKey, value);
              results.content.copied++;
            }
          }
        } catch (error) {
          results.content.failed++;
          results.content.errors.push(`Failed to migrate content key ${key.name}: ${error}`);
        }
      }
    }

    // Migrate PAGE_META to SPIKEME with meta: prefix
    if (env.PAGE_META) {
      const metaList = await env.PAGE_META.list({ limit: 1000 });
      for (const key of metaList.keys) {
        try {
          const targetKey = `meta:${key.name}`;
          const existing = await env.SPIKEME.get(targetKey);
          
          if (existing) {
            results.meta.skipped++;
          } else {
            const value = await env.PAGE_META.get(key.name);
            if (value) {
              await env.SPIKEME.put(targetKey, value);
              results.meta.copied++;
            }
          }
        } catch (error) {
          results.meta.failed++;
          results.meta.errors.push(`Failed to migrate meta key ${key.name}: ${error}`);
        }
      }
    }

    // Migrate PAGE_STATE to SPIKEME with state: prefix
    if (env.PAGE_STATE) {
      const stateList = await env.PAGE_STATE.list({ limit: 1000 });
      for (const key of stateList.keys) {
        try {
          const targetKey = `state:${key.name}`;
          const existing = await env.SPIKEME.get(targetKey);
          
          if (existing) {
            results.state.skipped++;
          } else {
            const value = await env.PAGE_STATE.get(key.name);
            if (value) {
              await env.SPIKEME.put(targetKey, value);
              results.state.copied++;
            }
          }
        } catch (error) {
          results.state.failed++;
          results.state.errors.push(`Failed to migrate state key ${key.name}: ${error}`);
        }
      }
    }

    return json({
      success: true,
      message: "Migration completed",
      results,
      summary: {
        totalCopied: results.content.copied + results.meta.copied + results.state.copied,
        totalSkipped: results.content.skipped + results.meta.skipped + results.state.skipped,
        totalFailed: results.content.failed + results.meta.failed + results.state.failed,
      }
    });

  } catch (error) {
    return json({
      success: false,
      error: "Migration failed",
      details: error instanceof Error ? error.message : String(error),
      results,
    }, { status: 500 });
  }
}