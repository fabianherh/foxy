import { extractWebEvidence } from "./context-dev";
import { createDemoEvidence, demoCandidate } from "./demo";
import { buildCandidateIntelligence } from "./evidence";
import { generateInterviewQuestions } from "./questions";
import type { AnalyzeCandidateRequest, AnalyzeCandidateResult } from "./types";

export async function analyzeCandidate(request: AnalyzeCandidateRequest): Promise<AnalyzeCandidateResult> {
  if (request.demoFallback && request.candidate.id !== demoCandidate.id) throw new Error("Demo fallback is only available for the synthetic demo candidate");
  const urls = [request.candidate.githubUrl, ...(request.candidate.portfolioUrls ?? [])].filter((url): url is string => Boolean(url));
  const webEvidence = request.demoFallback ? createDemoEvidence() : await extractWebEvidence(urls);
  const intelligence = buildCandidateIntelligence(request.candidate, request.role, webEvidence);
  const questions = await generateInterviewQuestions(intelligence);
  return { intelligence, questions };
}
