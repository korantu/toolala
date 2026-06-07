interface RateLimit {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  SPIKEME: KVNamespace;
  TTS_CACHE: R2Bucket;
  TTS_RATE_LIMIT: RateLimit;
  STT_RATE_LIMIT: RateLimit;
  GOOGLE_TTS_API_KEY: string;
  ELEVENLABS_API_KEY: string;
}
