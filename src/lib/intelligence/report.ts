import { generateStructured } from "./llm";
import type { AnswerEvaluation, CandidateIntelligence, CompetencyVerdict, Recommendation, TechnicalAssessment, VerificationStatus } from "./types";

const reportNarrativeSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, maxItems: 5 },
    risks: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
  required: ["summary", "strengths", "risks"],
  additionalProperties: false,
} as const;

type ReportNarrative = Pick<TechnicalAssessment, "summary" | "strengths" | "risks">;

function statusFrom(score: number, confidence: number, answerCount: number): VerificationStatus {
  if (!answerCount || confidence < 0.35) return "needs_human_review";
  if (score >= 72) return "verified";
  if (score >= 48) return "partially_verified";
  return "unverified";
}

function buildVerdicts(intelligence: CandidateIntelligence, evaluations: AnswerEvaluation[]): CompetencyVerdict[] {
  return intelligence.competencies.map((item) => {
    const answers = evaluations.filter((evaluation) => evaluation.competencyId === item.competency.id);
    const score = answers.length ? Math.round(answers.reduce((sum, answer) => sum + answer.score * answer.confidence, 0) / Math.max(0.01, answers.reduce((sum, answer) => sum + answer.confidence, 0))) : 0;
    const confidence = answers.length ? Math.min(0.98, answers.reduce((sum, answer) => sum + answer.confidence, 0) / answers.length + (answers.length > 1 ? 0.08 : 0)) : 0;
    const status = statusFrom(score, confidence, answers.length);
    return {
      competencyId: item.competency.id,
      competencyName: item.competency.name,
      status,
      score,
      confidence: Math.round(confidence * 100) / 100,
      rationale: answers.length
        ? `${answers.map((answer) => answer.rationale).join(" ")} Public evidence strength: ${item.strength}.`.slice(0, 2400)
        : `No interview answer was captured for ${item.competency.name}; a human decision is required. Public evidence strength: ${item.strength}.`,
      evidenceRefs: [...new Set([...item.evidence.map((evidence) => evidence.id), ...answers.flatMap((answer) => answer.evidenceRefs)])],
      answerRefs: answers.map((answer) => answer.questionId),
    };
  });
}

function recommendationFor(intelligence: CandidateIntelligence, verdicts: CompetencyVerdict[], overallScore: number): Recommendation {
  const requiredIds = new Set(intelligence.role.competencies.filter((item) => item.required).map((item) => item.id));
  const required = verdicts.filter((verdict) => requiredIds.has(verdict.competencyId));
  if (required.some((verdict) => verdict.status === "needs_human_review")) return "human_review";
  const failedRequired = required.filter((verdict) => verdict.score < 45).length;
  if (failedRequired >= 2 || overallScore < 48) return "do_not_advance";
  if (overallScore >= 70 && required.every((verdict) => verdict.score >= 58)) return "advance";
  return "human_review";
}

function fallbackNarrative(verdicts: CompetencyVerdict[], recommendation: Recommendation): ReportNarrative {
  const ranked = [...verdicts].sort((a, b) => b.score - a.score);
  const strengths = ranked.filter((item) => item.status === "verified").slice(0, 3).map((item) => `${item.competencyName}: verified at ${item.score}/100 with ${Math.round(item.confidence * 100)}% confidence.`);
  const risks = ranked.filter((item) => item.status !== "verified").reverse().slice(0, 3).map((item) => `${item.competencyName}: ${item.status.replaceAll("_", " ")} at ${item.score}/100.`);
  return {
    summary: `Recommendation: ${recommendation.replaceAll("_", " ")}. The decision combines competency-weighted interview performance with traceable public evidence; missing evidence is treated as uncertainty, not dishonesty.`,
    strengths,
    risks,
  };
}

export async function buildTechnicalAssessment(intelligence: CandidateIntelligence, evaluations: AnswerEvaluation[]): Promise<TechnicalAssessment> {
  const verdicts = buildVerdicts(intelligence, evaluations);
  const weights = new Map(intelligence.role.competencies.map((item) => [item.id, item.weight]));
  const totalWeight = verdicts.reduce((sum, verdict) => sum + (weights.get(verdict.competencyId) ?? 1), 0);
  const overallScore = totalWeight ? Math.round(verdicts.reduce((sum, verdict) => sum + verdict.score * (weights.get(verdict.competencyId) ?? 1), 0) / totalWeight) : 0;
  const recommendation = recommendationFor(intelligence, verdicts, overallScore);
  const narrative = await generateStructured<ReportNarrative>(
    "foxy_assessment_narrative",
    reportNarrativeSchema,
    "Write a concise, evidence-backed technical hiring assessment. Do not introduce facts. Separate demonstrated strengths from uncertainty. Never speculate about honesty, personality, protected characteristics, communication style, or culture fit. Mention evidence IDs only when they exist in the input. The recommendation is fixed and must not be changed.",
    { recommendation, overallScore, verdicts },
  ) ?? fallbackNarrative(verdicts, recommendation);
  return {
    candidateId: intelligence.candidate.id,
    roleId: intelligence.role.id,
    recommendation,
    overallScore,
    summary: narrative.summary.slice(0, 2000),
    strengths: narrative.strengths.slice(0, 5),
    risks: narrative.risks.slice(0, 5),
    competencies: verdicts,
    generatedAt: Date.now(),
  };
}
