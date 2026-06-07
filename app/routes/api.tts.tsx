import { type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/cloudflare";

const MAX_CHARS = 100;
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

// All Gemini voices are multilingual — language is detected from input text.
// Aoede: bright and natural. Swap to any Gemini voice name you prefer.
const VOICE_FOR: Record<string, string> = {
  hebrew:  "Aoede",
  spanish: "Aoede",
  default: "Aoede",
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

// Wrap raw 24kHz 16-bit mono PCM in a WAV container so browsers can play it.
function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buf = new ArrayBuffer(44 + pcm.length);
  const v = new DataView(buf);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true);
  w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);               // PCM
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  w(36, "data"); v.setUint32(40, pcm.length, true);
  new Uint8Array(buf).set(pcm, 44);
  return new Uint8Array(buf);
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

  // voice field takes priority; lang (BCP-47 e.g. "he-IL") is the friendly alternative
  let voiceKey: string;
  if (typeof body.voice === "string" && body.voice in VOICE_FOR) {
    voiceKey = body.voice;
  } else if (typeof body.lang === "string") {
    voiceKey = langToVoice(body.lang);
  } else {
    voiceKey = "default";
  }
  const voiceName = VOICE_FOR[voiceKey];

  const cacheKey = await sha256Hex(JSON.stringify({ v: 3, provider: "gemini", voice: voiceName, text }));
  const objectKey = `tts/${cacheKey}.wav`;

  const cached = await env.TTS_CACHE.get(objectKey);
  if (cached) {
    const h = corsHeaders();
    h.set("Content-Type", "audio/wav");
    h.set("Cache-Control", "public, max-age=31536000, immutable");
    h.set("X-TTS-Cache", "hit");
    return new Response(cached.body, { headers: h });
  }

  const limited = await env.TTS_RATE_LIMIT.limit({ key: "global" });
  if (!limited.success) {
    return jsonError({ error: "rate_limited", message: "Too many generations. Try again soon." }, 429);
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const details = await geminiRes.text().catch(() => "");
    return jsonError({ error: "tts_failed", status: geminiRes.status, details: details.slice(0, 500) }, 502);
  }

  const data = await geminiRes.json() as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };

  const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) {
    return jsonError({ error: "tts_empty_response" }, 502);
  }

  // Gemini returns 24kHz 16-bit mono PCM — wrap in WAV container
  const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const wav = pcmToWav(pcm);

  await env.TTS_CACHE.put(objectKey, wav, {
    httpMetadata: {
      contentType: "audio/wav",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const h = corsHeaders();
  h.set("Content-Type", "audio/wav");
  h.set("Cache-Control", "public, max-age=31536000, immutable");
  h.set("X-TTS-Cache", "miss");
  return new Response(wav, { headers: h });
}
