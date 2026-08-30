import { buildTechnicalAssessment } from "@/lib/intelligence/report";
import { parseReportRequest } from "@/lib/intelligence/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { intelligence, evaluations } = parseReportRequest(await request.json());
    return Response.json(await buildTechnicalAssessment(intelligence, evaluations));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment generation failed";
    const isInputError = error instanceof SyntaxError || message.includes("must") || message.includes("invalid");
    return Response.json({ error: message }, { status: isInputError ? 400 : 502 });
  }
}
