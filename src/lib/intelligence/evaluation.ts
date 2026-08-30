import { generateStructured } from "./llm";
import type { AnswerEvaluation, AuthenticityAssessment, EvaluateAnswerRequest, InterviewQuestion, QuestionSubscores, VerificationStatus } from "./types";

const evaluationSchema = {
  type: "object",
  properties: {
    technicalAccuracy: { type: "number", minimum: 0, maximum: 10 },
    depthOfUnderstanding: { type: "number", minimum: 0, maximum: 10 },
    requirementAlignment: { type: "number", minimum: 0, maximum: 10 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    demonstratedSignals: { type: "array", items: { type: "string" } },
    missingSignals: { type: "array", items: { type: "string" } },
    rationale: { type: "string" },
    authenticityStatus: { type: "string", enum: ["consistent", "insufficient_evidence", "inconsistent_with_repository_evidence"] },
    authenticityRationale: { type: "string" },
    suggestedFollowUp: { type: ["string", "null"] },
  },
  required: ["technicalAccuracy", "depthOfUnderstanding", "requirementAlignment", "confidence", "demonstratedSignals", "missingSignals", "rationale", "authenticityStatus", "authenticityRationale", "suggestedFollowUp"],
  additionalProperties: false,
} as const;

type GeneratedEvaluation = {
  technicalAccuracy: number;
  depthOfUnderstanding: number;
  requirementAlignment: number;
  confidence: number;
  demonstratedSignals: string[];
  missingSignals: string[];
  rationale: string;
  authenticityStatus: AuthenticityAssessment["status"];
  authenticityRationale: string;
  suggestedFollowUp: string | null;
};

function normalizedWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(/\s+/).filter(Boolean);
}

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
}

function fallbackEvaluation(request: EvaluateAnswerRequest): GeneratedEvaluation {
  const words = normalizedWords(request.answer);
  const demonstratedSignals = request.question.expectedSignals.filter((signal) => normalizedWords(signal).some((term) => term.length > 3 && words.includes(term)));
  const missingSignals = request.question.expectedSignals.filter((signal) => !demonstratedSignals.includes(signal));
  const reasoningSignals = ["because", "instead", "trade-off", "tested", "measured", "failed", "debugged", "implemented"].filter((signal) => request.answer.toLowerCase().includes(signal));
  const detail = Math.min(10, 1.5 + Math.min(words.length, 120) * 0.045 + demonstratedSignals.length * 0.55);
  const depth = Math.min(10, 1.5 + Math.min(words.length, 100) * 0.03 + reasoningSignals.length * 1.05);
  const alignment = Math.min(10, 2 + demonstratedSignals.length * 1.4);
  return {
    technicalAccuracy: detail,
    depthOfUnderstanding: depth,
    requirementAlignment: alignment,
    confidence: words.length >= 40 ? 0.62 : 0.42,
    demonstratedSignals: [...demonstratedSignals, ...reasoningSignals.map((signal) => `Answer includes a concrete ${signal} signal`)].slice(0, 6),
    missingSignals: missingSignals.slice(0, 6),
    rationale: words.length < 12 ? "The answer is too brief to support a reliable technical judgment." : `The answer contains ${reasoningSignals.length} reasoning signal${reasoningSignals.length === 1 ? "" : "s"} and addresses ${demonstratedSignals.length} expected signal${demonstratedSignals.length === 1 ? "" : "s"}.`,
    authenticityStatus: "insufficient_evidence",
    authenticityRationale: "Automated fallback grading cannot reliably compare this answer with repository evidence.",
    suggestedFollowUp: (detail + depth + alignment) / 3 < 7.2 ? "Can you make that concrete: what did you personally implement, what trade-off did you make, and how did you verify the result?" : null,
  };
}

function createFollowUp(request: EvaluateAnswerRequest, generated: GeneratedEvaluation, questionScore: number): InterviewQuestion | undefined {
  const priorFollowUps = (request.previousEvaluations ?? []).filter((item) => item.competencyId === request.question.competencyId && item.followUp).length;
  if (!generated.suggestedFollowUp || priorFollowUps >= 2 || questionScore >= 7.8) return undefined;
  return {
    id: `${request.question.id}-follow-up-${priorFollowUps + 1}`,
    competencyId: request.question.competencyId,
    kind: "adaptive_follow_up",
    prompt: generated.suggestedFollowUp.slice(0, 600),
    rationale: `The previous answer scored ${questionScore}/10 and needs clarification: ${generated.missingSignals.slice(0, 2).join(", ") || "technical specificity"}.`,
    evidenceRefs: request.question.evidenceRefs,
    expectedSignals: generated.missingSignals.slice(0, 5),
    sequence: request.question.sequence + (priorFollowUps + 1) / 10,
    parentQuestionId: request.question.id,
  };
}

export async function evaluateAnswer(request: EvaluateAnswerRequest): Promise<AnswerEvaluation> {
  const competency = request.intelligence.competencies.find((item) => item.competency.id === request.question.competencyId);
  if (!competency) throw new Error("Question references an unknown competency");
  const generated = await generateStructured<GeneratedEvaluation>(
    "foxy_answer_evaluation",
    evaluationSchema,
    "Grade technical substance using three independent 0-10 scores: technical accuracy, depth of understanding, and alignment with the targeted requirement. Compare claims against supplied repository evidence. Only label an answer inconsistent_with_repository_evidence when a concrete contradiction exists; vagueness or missing evidence is insufficient_evidence, not inconsistency. Authenticity is a separate flag and must not affect numeric scores. Never assess accent, grammar, verbosity, confidence, personality, demographic proxies, or culture fit. Suggest one concise follow-up for the most important missing technical signal, or null when sufficient.",
    {
      competency: { name: competency.competency.name, description: competency.competency.description, required: competency.competency.required },
      question: request.question,
      answer: request.answer.slice(0, 12000),
      evidence: competency.evidence.map((item) => ({ id: item.id, name: item.name, description: item.description, technologies: item.technologies, signals: item.signals, excerpt: item.source.excerpt })),
      priorEvaluations: (request.previousEvaluations ?? []).filter((item) => item.competencyId === request.question.competencyId).map((item) => ({ questionScore: item.questionScore, rationale: item.rationale, missingSignals: item.missingSignals })),
    },
  ) ?? fallbackEvaluation(request);
  const subscores: QuestionSubscores = {
    technicalAccuracy: clampScore(generated.technicalAccuracy),
    depthOfUnderstanding: clampScore(generated.depthOfUnderstanding),
    requirementAlignment: clampScore(generated.requirementAlignment),
  };
  const questionScore = Math.round(((subscores.technicalAccuracy + subscores.depthOfUnderstanding + subscores.requirementAlignment) / 3) * 10) / 10;
  const score = Math.round(questionScore * 10);
  const confidence = Math.max(0, Math.min(1, generated.confidence));
  const status: VerificationStatus = confidence < 0.35 ? "needs_human_review" : questionScore >= 7.2 ? "verified" : questionScore >= 4.5 ? "partially_verified" : questionScore < 2.5 ? "needs_human_review" : "unverified";
  return {
    questionId: request.question.id,
    competencyId: request.question.competencyId,
    answer: request.answer.slice(0, 12000),
    score,
    questionScore,
    subscores,
    authenticity: { status: generated.authenticityStatus, rationale: generated.authenticityRationale.slice(0, 800) },
    status,
    confidence,
    demonstratedSignals: generated.demonstratedSignals.slice(0, 8),
    missingSignals: generated.missingSignals.slice(0, 8),
    rationale: generated.rationale.slice(0, 1200),
    evidenceRefs: request.question.evidenceRefs,
    followUp: createFollowUp(request, generated, questionScore),
  };
}
