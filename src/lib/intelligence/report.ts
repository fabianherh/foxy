import { generateStructured } from "./llm";
import type { AnswerEvaluation, AuthenticityFlag, CandidateIntelligence, CompetencyVerdict, MustHaveResult, QuestionSubscores, Recommendation, TechnicalAssessment, VerificationStatus } from "./types";

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

function averageSubscores(answers: AnswerEvaluation[]): QuestionSubscores {
  if (!answers.length) return { technicalAccuracy: 0, depthOfUnderstanding: 0, requirementAlignment: 0 };
  const average = (key: keyof QuestionSubscores) => Math.round((answers.reduce((sum, answer) => sum + answer.subscores[key], 0) / answers.length) * 10) / 10;
  return { technicalAccuracy: average("technicalAccuracy"), depthOfUnderstanding: average("depthOfUnderstanding"), requirementAlignment: average("requirementAlignment") };
}

function buildVerdicts(intelligence: CandidateIntelligence, evaluations: AnswerEvaluation[]): CompetencyVerdict[] {
  return intelligence.competencies.map((item) => {
    const answers = evaluations.filter((evaluation) => evaluation.competencyId === item.competency.id);
    const averageQuestionScore = answers.length ? answers.reduce((sum, answer) => sum + answer.questionScore * answer.confidence, 0) / Math.max(0.01, answers.reduce((sum, answer) => sum + answer.confidence, 0)) : 0;
    const score = Math.round(averageQuestionScore * 10);
    const confidence = answers.length ? Math.min(0.98, answers.reduce((sum, answer) => sum + answer.confidence, 0) / answers.length + (answers.length > 1 ? 0.08 : 0)) : 0;
    const demonstrated = item.strength === "strong" || answers.some((answer) => answer.questionScore >= 6 && answer.demonstratedSignals.length > 0);
    return {
      competencyId: item.competency.id,
      competencyName: item.competency.name,
      status: statusFrom(score, confidence, answers.length),
      score,
      subscores: averageSubscores(answers),
      mustHave: item.competency.required,
      demonstrated,
      confidence: Math.round(confidence * 100) / 100,
      rationale: answers.length
        ? `${answers.map((answer) => answer.rationale).join(" ")} Public evidence strength: ${item.strength}.`.slice(0, 2400)
        : `No interview answer was captured for ${item.competency.name}; a human decision is required. Public evidence strength: ${item.strength}.`,
      evidenceRefs: [...new Set([...item.evidence.map((evidence) => evidence.id), ...answers.flatMap((answer) => answer.evidenceRefs)])],
      answerRefs: answers.map((answer) => answer.questionId),
    };
  });
}

function recommendationFor(verdicts: CompetencyVerdict[], overallScore: number, authenticityFlags: AuthenticityFlag[]): Recommendation {
  const required = verdicts.filter((verdict) => verdict.mustHave);
  if (required.some((verdict) => verdict.status === "needs_human_review") || required.some((verdict) => !verdict.demonstrated) || authenticityFlags.length) return "human_review";
  if (overallScore < 48) return "do_not_advance";
  if (overallScore >= 70 && required.every((verdict) => verdict.score >= 58)) return "advance";
  return "human_review";
}

function fallbackNarrative(verdicts: CompetencyVerdict[], recommendation: Recommendation, authenticityFlags: AuthenticityFlag[]): ReportNarrative {
  const ranked = [...verdicts].sort((a, b) => b.score - a.score);
  const strengths = ranked.filter((item) => item.status === "verified").slice(0, 3).map((item) => `${item.competencyName}: ${item.score}/100, led by technical accuracy ${item.subscores.technicalAccuracy}/10 and depth ${item.subscores.depthOfUnderstanding}/10.`);
  const risks = [
    ...ranked.filter((item) => item.mustHave && !item.demonstrated).map((item) => `${item.competencyName}: must-have not demonstrated.`),
    ...authenticityFlags.map((flag) => `Repository authenticity flag: ${flag.rationale}`),
    ...ranked.filter((item) => item.status !== "verified").reverse().map((item) => `${item.competencyName}: ${item.status.replaceAll("_", " ")} at ${item.score}/100.`),
  ].slice(0, 5);
  return {
    summary: `Recommendation: ${recommendation.replaceAll("_", " ")}. The weighted score reflects technical accuracy, depth, and requirement alignment. Must-have gaps and repository inconsistencies remain separate human-review flags.`,
    strengths,
    risks,
  };
}

export async function buildTechnicalAssessment(intelligence: CandidateIntelligence, evaluations: AnswerEvaluation[]): Promise<TechnicalAssessment> {
  const verdicts = buildVerdicts(intelligence, evaluations);
  const weights = new Map(intelligence.role.competencies.map((item) => [item.id, item.weight]));
  const scoredVerdicts = verdicts.filter((verdict) => verdict.answerRefs.length > 0);
  const totalWeight = scoredVerdicts.reduce((sum, verdict) => sum + (weights.get(verdict.competencyId) ?? 1), 0);
  const overallScore = totalWeight ? Math.round(scoredVerdicts.reduce((sum, verdict) => sum + (weights.get(verdict.competencyId) ?? 1) * (verdict.score / 10), 0) / totalWeight * 10) : 0;
  const authenticityFlags: AuthenticityFlag[] = evaluations.filter((evaluation) => evaluation.authenticity.status === "inconsistent_with_repository_evidence").map((evaluation) => ({ questionId: evaluation.questionId, competencyId: evaluation.competencyId, rationale: evaluation.authenticity.rationale, evidenceRefs: evaluation.evidenceRefs }));
  const mustHaves: MustHaveResult[] = verdicts.filter((verdict) => verdict.mustHave).map((verdict) => ({ competencyId: verdict.competencyId, competencyName: verdict.competencyName, demonstrated: verdict.demonstrated }));
  const recommendation = recommendationFor(verdicts, overallScore, authenticityFlags);
  const narrative = await generateStructured<ReportNarrative>(
    "foxy_assessment_narrative",
    reportNarrativeSchema,
    "Write a concise technical hiring assessment grounded only in the supplied rubric results. Separate numeric performance, missing must-haves, and repository authenticity flags. Never turn absence of evidence into dishonesty. Never speculate about personality, protected characteristics, speaking style, or culture fit. The recommendation is fixed.",
    { recommendation, overallScore, verdicts, mustHaves, authenticityFlags },
  ) ?? fallbackNarrative(verdicts, recommendation, authenticityFlags);
  return {
    candidateId: intelligence.candidate.id,
    roleId: intelligence.role.id,
    recommendation,
    overallScore,
    summary: narrative.summary.slice(0, 2000),
    strengths: narrative.strengths.slice(0, 5),
    risks: narrative.risks.slice(0, 5),
    competencies: verdicts,
    mustHaves,
    authenticityFlags,
    generatedAt: Date.now(),
  };
}
