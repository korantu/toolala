import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/cloudflare";

/**
 * API endpoint for referrer-scoped JSON data storage in KV.
 * 
 * Routes:
 * - GET /api/v1/json_data/{path?} - Retrieve JSON data
 * - POST /api/v1/json_data/{path?} - Store JSON data
 * 
 * Key format: apiv1json:<referrer>:<path>
 */

const MAX_VALUE_SIZE = 1024 * 1024; // 1 MB limit for KV values
const MAX_KEY_SIZE = 512; // 512 bytes limit for KV keys

/**
 * Get referrer from request headers.
 * Falls back to Origin, then "unknown" if both are missing.
 */
function getReferrer(request: Request): string {
  const referer = request.headers.get("Referer");
  if (referer) {
    return referer;
  }
  const origin = request.headers.get("Origin");
  if (origin) {
    return origin;
  }
  return "unknown";
}

/**
 * Validate and sanitize path segment.
 * Rejects paths with "..", leading/trailing slashes are normalized.
 */
function validatePath(path: string): { valid: boolean; sanitized: string; error?: string } {
  // Empty path is valid
  if (!path || path === "") {
    return { valid: true, sanitized: "" };
  }

  // URL decode the path first to prevent encoded directory traversal
  let sanitized: string;
  try {
    sanitized = decodeURIComponent(path);
  } catch {
    return { valid: false, sanitized: "", error: "Invalid path: unable to decode" };
  }

  // Normalize by removing leading and trailing slashes
  sanitized = sanitized.replace(/^\/+/, "").replace(/\/+$/, "");

  // Check for directory traversal attempts after decoding
  if (sanitized.includes("..")) {
    return { valid: false, sanitized: "", error: "Invalid path: directory traversal not allowed" };
  }

  return { valid: true, sanitized };
}

/**
 * Construct KV key from referrer and path.
 */
function constructKey(referrer: string, path: string): { key: string; error?: string } {
  const key = `apiv1json:${referrer}:${path}`;
  
  // Check key size limit
  if (new TextEncoder().encode(key).length > MAX_KEY_SIZE) {
    return { key: "", error: "Key size exceeds 512 bytes limit" };
  }
  
  return { key };
}

/**
 * Add CORS headers to response.
 */
function addCorsHeaders(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Referer, Origin");
}

/**
 * Handle OPTIONS requests for CORS preflight.
 */
export async function loader({ params, context, request }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const headers = new Headers();
    addCorsHeaders(headers);
    return new Response(null, { status: 204, headers });
  }

  // Get path from splat parameter
  const path = params["*"] || "";
  
  // Validate path
  const pathValidation = validatePath(path);
  if (!pathValidation.valid) {
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ error: pathValidation.error }, { status: 400, headers });
  }

  // Get referrer
  const referrer = getReferrer(request);

  // Construct key
  const { key, error: keyError } = constructKey(referrer, pathValidation.sanitized);
  if (keyError) {
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ error: keyError }, { status: 400, headers });
  }

  // Retrieve from KV
  const kv = context.cloudflare.env.SPIKEME;
  try {
    const value = await kv.get(key);
    
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);

    if (!value) {
      // Return empty object if key doesn't exist
      return json({}, { status: 200, headers });
    }

    // Parse and return stored data
    try {
      const data = JSON.parse(value);
      return json({ data }, { status: 200, headers });
    } catch {
      // If stored value is not valid JSON, return it as-is wrapped in data
      return json({ data: value }, { status: 200, headers });
    }
  } catch (error) {
    console.error("KV read failed:", error);
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ error: "KV failure" }, { status: 500, headers });
  }
}

/**
 * Handle POST requests to store JSON data.
 */
export async function action({ params, context, request }: ActionFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const headers = new Headers();
    addCorsHeaders(headers);
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ error: "Method not allowed" }, { status: 405, headers });
  }

  // Get path from splat parameter
  const path = params["*"] || "";
  
  // Validate path
  const pathValidation = validatePath(path);
  if (!pathValidation.valid) {
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ error: pathValidation.error }, { status: 400, headers });
  }

  // Get referrer
  const referrer = getReferrer(request);

  // Construct key
  const { key, error: keyError } = constructKey(referrer, pathValidation.sanitized);
  if (keyError) {
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ error: keyError }, { status: 400, headers });
  }

  // Parse request body
  let data: any;
  try {
    data = await request.json();
  } catch {
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ error: "Invalid JSON in request body" }, { status: 400, headers });
  }

  // Serialize data
  const valueStr = JSON.stringify(data);
  const valueSize = new TextEncoder().encode(valueStr).length;

  // Check size limit
  if (valueSize > MAX_VALUE_SIZE) {
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ error: `Storage failed: value size ${valueSize} bytes exceeds 1 MB limit` }, { status: 413, headers });
  }

  // Store in KV
  const kv = context.cloudflare.env.SPIKEME;
  try {
    await kv.put(key, valueStr);
    
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    return json({ status: "stored", key }, { status: 201, headers });
  } catch (error) {
    console.error("KV write failed:", error);
    const headers = new Headers({ "Content-Type": "application/json" });
    addCorsHeaders(headers);
    
    // Check if it's a rate limit error (Cloudflare KV returns specific error codes)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("rate") || errorMessage.includes("limit")) {
      return json({ error: "Storage failed: rate limit exceeded" }, { status: 429, headers });
    }
    
    return json({ error: "Storage failed: KV write error" }, { status: 500, headers });
  }
}
