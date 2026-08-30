import { parsePublicUrl } from "./public-url";
import type { CandidateClaim, EvidenceStrength, ProjectEvidence, WebEvidenceBundle } from "./types";

const CONTEXT_API = "https://api.context.dev/v1/web/extract";

const evidenceSchema = {
  type: "object",
  properties: {
    projects: {
      type: "array",
      description: "Public software projects or repositories visibly associated with this candidate.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Project or repository name." },
          description: { type: "string", description: "Factual project description from the page or README." },
          url: { type: "string", description: "Direct public URL to the project or repository." },
          technologies: { type: "array", items: { type: "string" }, description: "Technologies explicitly evidenced by files, language data, README, or project copy." },
          signals: { type: "array", items: { type: "string" }, description: "Concrete implementation signals such as source files, tests, API routes, database config, CI, or deployment files." },
          evidenceExcerpt: { type: "string", description: "Short verbatim excerpt that supports the evidence." },
          strength: { type: "string", enum: ["strong", "moderate", "weak"], description: "Strength based only on visible public evidence." },
        },
        required: ["name", "description", "url", "technologies", "signals", "evidenceExcerpt", "strength"],
        additionalProperties: false,
      },
    },
    technologies: { type: "array", items: { type: "string" }, description: "Deduplicated technologies with direct public evidence." },
    claims: {
      type: "array",
      description: "Technical claims explicitly stated on the public profile, repositories, READMEs, or portfolio.",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          technologies: { type: "array", items: { type: "string" } },
        },
        required: ["statement", "technologies"],
        additionalProperties: false,
      },
    },
  },
  required: ["projects", "technologies", "claims"],
  additionalProperties: false,
} as const;

type ExtractedData = {
  projects?: Array<{
    name?: string;
    description?: string;
    url?: string;
    technologies?: string[];
    signals?: string[];
    evidenceExcerpt?: string;
    strength?: EvidenceStrength;
  }>;
  technologies?: string[];
  claims?: Array<{ statement?: string; technologies?: string[] }>;
};

type ContextResponse = { data?: ExtractedData; urls_analyzed?: string[]; urlsAnalyzed?: string[]; error?: string; message?: string };

function cleanStrings(values: unknown, max = 20): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))].slice(0, max);
}

function normalize(data: ExtractedData, requestedUrl: string, analyzedUrls: string[], index: number): { projects: ProjectEvidence[]; claims: CandidateClaim[]; technologies: string[] } {
  const sourceType: "github_profile" | "portfolio" = new URL(requestedUrl).hostname.toLowerCase() === "github.com" ? "github_profile" : "portfolio";
  const projects = (Array.isArray(data.projects) ? data.projects : []).slice(0, 12).map((project, projectIndex) => {
    const url = typeof project.url === "string" ? project.url : requestedUrl;
    const technologies = cleanStrings(project.technologies);
    const signals = cleanStrings(project.signals);
    const excerpt = typeof project.evidenceExcerpt === "string" ? project.evidenceExcerpt.slice(0, 500) : "";
    return {
      id: `web-${index}-${projectIndex}`,
      name: typeof project.name === "string" ? project.name.slice(0, 120) : `Project ${projectIndex + 1}`,
      description: typeof project.description === "string" ? project.description.slice(0, 1000) : "",
      url,
      technologies,
      signals,
      strength: project.strength === "strong" || project.strength === "moderate" || project.strength === "weak" ? project.strength : signals.length >= 3 ? "strong" : signals.length ? "moderate" : "weak",
      source: { url, title: typeof project.name === "string" ? project.name.slice(0, 120) : "Public project", excerpt, sourceType: url.includes("github.com/") ? "repository" as const : sourceType },
    };
  });
  const claims = (Array.isArray(data.claims) ? data.claims : []).slice(0, 20).map((claim, claimIndex) => ({
    id: `web-claim-${index}-${claimIndex}`,
    statement: typeof claim.statement === "string" ? claim.statement.slice(0, 500) : "",
    technologies: cleanStrings(claim.technologies),
    source: sourceType === "github_profile" ? "github" as const : "portfolio" as const,
  })).filter((claim) => claim.statement);
  return { projects, claims, technologies: cleanStrings(data.technologies) };
}

async function extractUrl(url: string, apiKey: string, index: number): Promise<{ projects: ProjectEvidence[]; claims: CandidateClaim[]; technologies: string[]; analyzedUrls: string[] }> {
  parsePublicUrl(url);
  const response = await fetch(CONTEXT_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Context-Tag": "foxy-candidate-evidence" },
    body: JSON.stringify({
      url,
      schema: evidenceSchema,
      instructions: "Analyze only public evidence connected to this candidate. Prioritize repositories, project pages, READMEs, source structure, tests, API/database configuration, and deployment files. Do not infer technologies without visible support. Preserve direct URLs and short supporting excerpts.",
      factCheck: true,
      maxPages: 8,
      maxDepth: 2,
      stopAfterMs: 60000,
      timeoutMS: 70000,
      maxAgeMs: 3600000,
    }),
    signal: AbortSignal.timeout(75000),
  });
  const payload = await response.json().catch(() => ({})) as ContextResponse;
  if (!response.ok) throw new Error(`Context.dev extraction failed (${response.status}): ${payload.message || payload.error || "unknown error"}`);
  const analyzedUrls = payload.urls_analyzed ?? payload.urlsAnalyzed ?? [url];
  return { ...normalize(payload.data ?? {}, url, analyzedUrls, index), analyzedUrls };
}

export async function extractWebEvidence(urls: string[], fallback?: WebEvidenceBundle): Promise<WebEvidenceBundle> {
  const uniqueUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, 3);
  if (!uniqueUrls.length) return { provider: "context.dev", analyzedUrls: [], projects: [], technologies: [], webClaims: [], extractedAt: Date.now() };
  const apiKey = process.env.CONTEXT_DEV_API_KEY || process.env.CONTEXT_API_KEY;
  if (!apiKey) {
    if (fallback) return fallback;
    throw new Error("CONTEXT_DEV_API_KEY is not configured");
  }
  const settled = await Promise.allSettled(uniqueUrls.map((url, index) => extractUrl(url, apiKey, index)));
  const results = settled.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof extractUrl>>> => result.status === "fulfilled").map((result) => result.value);
  if (!results.length) {
    if (fallback) return fallback;
    const firstFailure = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
    throw firstFailure?.reason instanceof Error ? firstFailure.reason : new Error("Context.dev could not analyze the supplied URLs");
  }
  return {
    provider: "context.dev",
    analyzedUrls: [...new Set(results.flatMap((result) => result.analyzedUrls))],
    projects: results.flatMap((result) => result.projects),
    technologies: [...new Set(results.flatMap((result) => result.technologies))],
    webClaims: results.flatMap((result) => result.claims),
    extractedAt: Date.now(),
  };
}
