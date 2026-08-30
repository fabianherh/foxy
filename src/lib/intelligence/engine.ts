import { extractWebEvidence } from "./context-dev";
import { createDemoEvidence, demoCandidate } from "./demo";
import { buildCandidateIntelligence } from "./evidence";
import { generateInterviewQuestions } from "./questions";
import { GITHUB_UNAVAILABLE, normalizeGithubProfileUrl, validateGithubProfile } from "./github";
import type { AnalyzeCandidateRequest, AnalyzeCandidateResult } from "./types";

async function resolveGithubUrl(githubUrl: string): Promise<string> {
  try {
    return (await validateGithubProfile(githubUrl)).profileUrl;
  } catch (error) {
    if (error instanceof Error && error.message === GITHUB_UNAVAILABLE) {
      console.error("GitHub re-validation unavailable, continuing with normalized profile URL");
      return normalizeGithubProfileUrl(githubUrl);
    }
    throw error;
  }
}

export async function analyzeCandidate(request: AnalyzeCandidateRequest): Promise<AnalyzeCandidateResult> {
  if (request.demoFallback && request.candidate.id !== demoCandidate.id) throw new Error("Demo fallback is only available for the synthetic demo candidate");
  const candidate = request.demoFallback || !request.candidate.githubUrl ? request.candidate : { ...request.candidate, githubUrl: await resolveGithubUrl(request.candidate.githubUrl) };
  const urls = [candidate.githubUrl, ...(candidate.portfolioUrls ?? [])].filter((url): url is string => Boolean(url));
  const webEvidence = request.demoFallback ? createDemoEvidence() : await extractWebEvidence(urls);
  const intelligence = buildCandidateIntelligence(candidate, request.role, webEvidence);
  const questions = await generateInterviewQuestions(intelligence);
  return { intelligence, questions };
}
