import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { createStateManager } from "../lib/state";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug!;
  const stateManager = createStateManager(context.cloudflare.env);
  
  try {
    const data = await stateManager.get(slug);
    return json(data || {});
  } catch (error) {
    return json({ error: "Failed to retrieve data" }, { status: 500 });
  }
}

export async function action({ params, context, request }: ActionFunctionArgs) {
  const slug = params.slug!;
  const stateManager = createStateManager(context.cloudflare.env);
  
  if (request.method === "POST") {
    try {
      const data = await request.json();
      await stateManager.set(slug, data);
      return json({ success: true });
    } catch (error) {
      return json({ error: "Failed to save data" }, { status: 400 });
    }
  }
  
  if (request.method === "DELETE") {
    try {
      await stateManager.delete(slug);
      return json({ success: true });
    } catch (error) {
      return json({ error: "Failed to delete data" }, { status: 500 });
    }
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
}