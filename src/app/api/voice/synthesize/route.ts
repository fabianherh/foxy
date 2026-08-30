import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const runtime = "nodejs";
export const maxDuration = 30;

const voiceRequests = new Map<string, number[]>();

function rateLimited(request: Request): boolean {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const cutoff = Date.now() - 60000;
  const recent = (voiceRequests.get(key) ?? []).filter((time) => time > cutoff);
  voiceRequests.set(key, recent);
  if (recent.length >= 12) return true;
  recent.push(Date.now());
  return false;
}

export async function POST(request: Request) {
  if (rateLimited(request)) return Response.json({ error: "Voice request limit reached", fallback: "browser_speech_synthesis" }, { status: 429 });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ error: "ElevenLabs is not configured", fallback: "browser_speech_synthesis" }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = typeof body === "object" && body !== null && "text" in body && typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 600) return Response.json({ error: "Text must contain 1-600 characters" }, { status: 400 });
  try {
    const client = new ElevenLabsClient({ apiKey });
    const audio = await client.textToSpeech.convert(process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM", {
      text,
      modelId: process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
      outputFormat: "mp3_44100_128",
      voiceSettings: { stability: 0.55, similarityBoost: 0.75, style: 0.15, useSpeakerBoost: true },
    });
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=300" } });
  } catch {
    return Response.json({ error: "Voice synthesis failed", fallback: "browser_speech_synthesis" }, { status: 502 });
  }
}
