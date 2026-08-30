import { evaluateAnswer } from "@/lib/intelligence/evaluation";
import { parseEvaluateRequest } from "@/lib/intelligence/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = parseEvaluateRequest(await request.json());
    return Response.json(await evaluateAnswer(input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Answer evaluation failed";
    const isInputError = error instanceof SyntaxError || message.includes("must") || message.includes("invalid") || message.includes("unknown competency");
    return Response.json({ error: message }, { status: isInputError ? 400 : 502 });
  }
}
