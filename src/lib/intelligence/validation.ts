import { parsePublicUrl } from "./public-url";
import type { AnalyzeCandidateRequest, AnswerEvaluation, CandidateIntelligence, EvaluateAnswerRequest, InterviewQuestion, RoleCompetency } from "./types";

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max) throw new Error(`${label} must be ${required ? "a non-empty " : "a "}string up to ${max} characters`);
  return value.trim();
}

function publicUrl(value: unknown, label: string): string {
  const raw = string(value, label, 2048);
  try {
    return parsePublicUrl(raw).toString();
  } catch {
    throw new Error(`${label} must be a public HTTP(S) URL`);
  }
}

function parseCompetency(value: unknown, index: number): RoleCompetency {
  const item = object(value, `role.competencies[${index}]`);
  const keywords = Array.isArray(item.keywords) ? item.keywords.map((keyword, keywordIndex) => string(keyword, `keyword ${keywordIndex}`, 80)).slice(0, 20) : [];
  return {
    id: string(item.id, `competency ${index} id`, 100),
    name: string(item.name, `competency ${index} name`, 120),
    description: string(item.description, `competency ${index} description`, 500),
    required: item.required !== false,
    weight: typeof item.weight === "number" && item.weight > 0 && item.weight <= 10 ? item.weight : 1,
    keywords,
  };
}

export function parseAnalyzeRequest(value: unknown): AnalyzeCandidateRequest {
  const root = object(value, "request");
  const candidate = object(root.candidate, "candidate");
  const role = object(root.role, "role");
  if (!Array.isArray(role.competencies) || role.competencies.length < 1 || role.competencies.length > 10) throw new Error("role.competencies must contain 1-10 items");
  const githubUrl = candidate.githubUrl == null || candidate.githubUrl === "" ? undefined : publicUrl(candidate.githubUrl, "candidate.githubUrl");
  if (githubUrl && new URL(githubUrl).hostname.toLowerCase() !== "github.com") throw new Error("candidate.githubUrl must be a public github.com URL");
  const portfolioUrls = Array.isArray(candidate.portfolioUrls) ? candidate.portfolioUrls.map((url, index) => publicUrl(url, `portfolioUrls[${index}]`)).slice(0, 2) : [];
  if (!githubUrl && !portfolioUrls.length) throw new Error("At least one GitHub or portfolio URL is required");
  return {
    candidate: {
      id: string(candidate.id, "candidate.id", 120),
      name: string(candidate.name, "candidate.name", 160),
      cvText: candidate.cvText == null ? "" : string(candidate.cvText, "candidate.cvText", 50000, false),
      githubUrl,
      portfolioUrls,
    },
    role: {
      id: string(role.id, "role.id", 120),
      title: string(role.title, "role.title", 200),
      competencies: role.competencies.map(parseCompetency),
    },
    demoFallback: root.demoFallback === true,
  };
}

function validateIntelligence(value: unknown): CandidateIntelligence {
  const intelligence = object(value, "intelligence");
  const candidate = object(intelligence.candidate, "intelligence.candidate");
  const role = object(intelligence.role, "intelligence.role");
  const webEvidence = object(intelligence.webEvidence, "intelligence.webEvidence");
  string(candidate.id, "intelligence.candidate.id", 120);
  if (!Array.isArray(role.competencies) || !Array.isArray(intelligence.competencies) || !Array.isArray(webEvidence.projects)) throw new Error("intelligence must include competency and evidence arrays");
  role.competencies.forEach((value, index) => string(object(value, `role competency ${index}`).id, `role competency ${index} id`, 100));
  intelligence.competencies.forEach((value, index) => string(object(object(value, `competency evidence ${index}`).competency, `competency evidence ${index}.competency`).id, `competency evidence ${index} id`, 100));
  return intelligence as unknown as CandidateIntelligence;
}

function validateQuestion(value: unknown): InterviewQuestion {
  const question = object(value, "question");
  string(question.id, "question.id", 200);
  string(question.competencyId, "question.competencyId", 100);
  string(question.prompt, "question.prompt", 1000);
  if (!Array.isArray(question.expectedSignals) || !Array.isArray(question.evidenceRefs) || typeof question.sequence !== "number") throw new Error("question must include expectedSignals, evidenceRefs, and sequence");
  question.expectedSignals.forEach((signal, index) => string(signal, `expectedSignals[${index}]`, 200));
  question.evidenceRefs.forEach((reference, index) => string(reference, `evidenceRefs[${index}]`, 200));
  if (question.format === "code_multiple_choice") {
    string(question.codeSnippet, "question.codeSnippet", 2000);
    if (!Array.isArray(question.choices) || question.choices.length !== 4) throw new Error("Code questions must include four choices");
  }
  return question as unknown as InterviewQuestion;
}

function validateEvaluations(value: unknown): AnswerEvaluation[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error("evaluations must be an array with at most 30 items");
  value.forEach((entry, index) => {
    const evaluation = object(entry, `evaluations[${index}]`);
    string(evaluation.questionId, `evaluations[${index}].questionId`, 200);
    string(evaluation.competencyId, `evaluations[${index}].competencyId`, 100);
    const subscores = object(evaluation.subscores, `evaluations[${index}].subscores`);
    const authenticity = object(evaluation.authenticity, `evaluations[${index}].authenticity`);
    if (typeof evaluation.score !== "number" || typeof evaluation.questionScore !== "number" || typeof evaluation.confidence !== "number" || typeof subscores.technicalAccuracy !== "number" || typeof subscores.depthOfUnderstanding !== "number" || typeof subscores.requirementAlignment !== "number" || typeof authenticity.status !== "string" || !Array.isArray(evaluation.evidenceRefs)) throw new Error(`evaluations[${index}] has invalid scores, authenticity, confidence, or evidenceRefs`);
  });
  return value as AnswerEvaluation[];
}

export function parseEvaluateRequest(value: unknown): EvaluateAnswerRequest {
  const root = object(value, "request");
  return {
    intelligence: validateIntelligence(root.intelligence),
    question: validateQuestion(root.question),
    answer: string(root.answer, "answer", 12000),
    previousEvaluations: root.previousEvaluations == null ? [] : validateEvaluations(root.previousEvaluations),
  };
}

export function parseReportRequest(value: unknown): { intelligence: CandidateIntelligence; evaluations: AnswerEvaluation[] } {
  const root = object(value, "request");
  return { intelligence: validateIntelligence(root.intelligence), evaluations: validateEvaluations(root.evaluations) };
}
