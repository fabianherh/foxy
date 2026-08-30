import { analyzeCandidate } from "@/lib/intelligence/engine";
import { analysisEvents } from "@/lib/intelligence/events";
import { parseAnalyzeRequest } from "@/lib/intelligence/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const input = parseAnalyzeRequest(await request.json());
    const result = await analyzeCandidate(input);
    return Response.json({ ...result, events: analysisEvents(result.intelligence, result.questions) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Candidate analysis failed";
    const isInputError = error instanceof SyntaxError || message.includes("must") || message.includes("required") || message.includes("JSON") || message.includes("Demo fallback");
    return Response.json({ error: message }, { status: isInputError ? 400 : 502 });
  }
}
