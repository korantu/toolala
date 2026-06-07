import { type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/cloudflare";

const MAX_AUDIO_BYTES = 200 * 1024; // ~10 seconds of typical mobile audio
const ALLOWED_LANGUAGES = new Set(["he", "es"]);
const STT_MODEL = "scribe_v1";

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

function jsonOk(body: object): Response {
  const h = corsHeaders();
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status: 200, headers: h });
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError({ error: "bad_request", message: "Expected multipart/form-data with 'audio' file and 'language' field." }, 400);
  }

  const language = formData.get("language");
  if (typeof language !== "string" || !ALLOWED_LANGUAGES.has(language)) {
    return jsonError({
      error: "unsupported_language",
      message: "Supported languages: he (Hebrew), es (Spanish).",
      supported: ["he", "es"],
    }, 400);
  }

  const audioFile = formData.get("audio");
  if (!(audioFile instanceof Blob)) {
    return jsonError({ error: "bad_request", message: "Missing 'audio' file in form data." }, 400);
  }

  if (audioFile.size > MAX_AUDIO_BYTES) {
    return jsonError({
      error: "audio_too_long",
      message: `Audio exceeds ${MAX_AUDIO_BYTES / 1024} KB limit (approximately 10 seconds).`,
      maxBytes: MAX_AUDIO_BYTES,
      actualBytes: audioFile.size,
    }, 413);
  }

  const limited = await env.STT_RATE_LIMIT.limit({ key: "global" });
  if (!limited.success) {
    return jsonError({ error: "rate_limited", message: "Too many transcriptions. Try again soon." }, 429);
  }

  const outForm = new FormData();
  outForm.append("file", audioFile, "audio.webm");
  outForm.append("model_id", STT_MODEL);
  outForm.append("language_code", language);

  const elevenRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
    body: outForm,
  });

  if (!elevenRes.ok) {
    const details = await elevenRes.text().catch(() => "");
    return jsonError({ error: "elevenlabs_failed", status: elevenRes.status, details: details.slice(0, 500) }, 502);
  }

  const result = await elevenRes.json() as { text?: string; language_code?: string };
  return jsonOk({ text: result.text ?? "", language_code: result.language_code ?? language });
}
