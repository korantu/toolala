import { type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/cloudflare";

const MAX_CHARS = 100;

// OpenAI TTS voices are all multilingual. nova is warm and natural.
// Other options: alloy, echo, fable, onyx, shimmer
const VOICE_FOR: Record<string, string> = {
  hebrew:  "nova",
  spanish: "nova",
  default: "nova",
};

function corsHeaders(): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  return h;
}

function jsonError(body: object, status: number): Response {
  const h = corsHeaders();
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: h });
}

function normalizeText(text: string): string {
  return text
    .split("")
    .filter((ch) => { const c = ch.charCodeAt(0); return c > 31 && c !== 127; })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function langToVoice(lang: string): string {
  if (lang.startsWith("he") || lang === "iw") return "hebrew";
  if (lang.startsWith("es")) return "spanish";
  return "default";
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return jsonError({ error: "method_not_allowed" }, 405);
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return jsonError({ error: "method_not_allowed" }, 405);
  }

  const env = context.cloudflare.env;

  let body: { text?: unknown; voice?: unknown; lang?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonError({ error: "bad_request" }, 400);
  }

  if (!body || typeof body.text !== "string") {
    return jsonError({ error: "bad_request" }, 400);
  }

  const text = normalizeText(body.text);
  if (!text) {
    return jsonError({ error: "empty_text" }, 400);
  }
  if (text.length > MAX_CHARS) {
    return jsonError({ error: "text_too_long", maxChars: MAX_CHARS, actualChars: text.length }, 413);
  }

  let voiceKey: string;
  if (typeof body.voice === "string" && body.voice in VOICE_FOR) {
    voiceKey = body.voice;
  } else if (typeof body.lang === "string") {
    voiceKey = langToVoice(body.lang);
  } else {
    voiceKey = "default";
  }
  const voiceName = VOICE_FOR[voiceKey];

  const cacheKey = await sha256Hex(JSON.stringify({ v: 4, provider: "openai", voice: voiceName, text }));
  const objectKey = `tts/${cacheKey}.mp3`;

  const cached = await env.TTS_CACHE.get(objectKey);
  if (cached) {
    const h = corsHeaders();
    h.set("Content-Type", "audio/mpeg");
    h.set("Cache-Control", "public, max-age=31536000, immutable");
    h.set("X-TTS-Cache", "hit");
    return new Response(cached.body, { headers: h });
  }

  const limited = await env.TTS_RATE_LIMIT.limit({ key: "global" });
  if (!limited.success) {
    return jsonError({ error: "rate_limited", message: "Too many generations. Try again soon." }, 429);
  }

  const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: voiceName,
      response_format: "mp3",
    }),
  });

  if (!openaiRes.ok) {
    const details = await openaiRes.text().catch(() => "");
    return jsonError({ error: "tts_failed", status: openaiRes.status, details: details.slice(0, 500) }, 502);
  }

  const audio = await openaiRes.arrayBuffer();

  await env.TTS_CACHE.put(objectKey, audio, {
    httpMetadata: {
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const h = corsHeaders();
  h.set("Content-Type", "audio/mpeg");
  h.set("Cache-Control", "public, max-age=31536000, immutable");
  h.set("X-TTS-Cache", "miss");
  return new Response(audio, { headers: h });
}
