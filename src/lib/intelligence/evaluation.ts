import { generateStructured } from "./llm";
import type { AnswerEvaluation, EvaluateAnswerRequest, InterviewQuestion, VerificationStatus } from "./types";

const evaluationSchema = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    status: { type: "string", enum: ["verified", "partially_verified", "unverified", "needs_human_review"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    demonstratedSignals: { type: "array", items: { type: "string" } },
    missingSignals: { type: "array", items: { type: "string" } },
    rationale: { type: "string" },
    suggestedFollowUp: { type: ["string", "null"] },
  },
  required: ["score", "status", "confidence", "demonstratedSignals", "missingSignals", "rationale", "suggestedFollowUp"],
  additionalProperties: false,
} as const;

type GeneratedEvaluation = Omit<AnswerEvaluation, "questionId" | "competencyId" | "answer" | "evidenceRefs" | "followUp"> & { suggestedFollowUp: string | null };

function normalizedWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(/\s+/).filter(Boolean);
}

function fallbackEvaluation(request: EvaluateAnswerRequest): GeneratedEvaluation {
  const words = normalizedWords(request.answer);
  const demonstratedSignals = request.question.expectedSignals.filter((signal) => normalizedWords(signal).some((term) => term.length > 3 && words.includes(term)));
  const missingSignals = request.question.expectedSignals.filter((signal) => !demonstratedSignals.includes(signal));
  const specificitySignals = ["because", "instead", "trade-off", "tested", "measured", "failed", "debugged", "implemented"].filter((signal) => request.answer.toLowerCase().includes(signal));
  const score = Math.min(85, Math.max(15, 20 + Math.min(words.length, 120) * 0.35 + demonstratedSignals.length * 8 + specificitySignals.length * 5));
  const status: VerificationStatus = score >= 72 ? "verified" : score >= 45 ? "partially_verified" : words.length < 12 ? "needs_human_review" : "unverified";
  return {
    score: Math.round(score),
    status,
    confidence: words.length >= 40 ? 0.62 : 0.42,
    demonstratedSignals: [...demonstratedSignals, ...specificitySignals.map((signal) => `Answer includes a concrete ${signal} signal`)].slice(0, 6),
    missingSignals: missingSignals.slice(0, 6),
    rationale: words.length < 12 ? "The answer is too brief to support a reliable technical judgment." : `The answer provides ${specificitySignals.length} concrete reasoning signal${specificitySignals.length === 1 ? "" : "s"} and addresses ${demonstratedSignals.length} expected signal${demonstratedSignals.length === 1 ? "" : "s"}.`,
    suggestedFollowUp: score < 72 ? `Can you make that concrete: what did you personally implement, what failed or could fail, and how did you verify the result?` : null,
  };
}

function createFollowUp(request: EvaluateAnswerRequest, generated: GeneratedEvaluation): InterviewQuestion | undefined {
  const priorFollowUps = (request.previousEvaluations ?? []).filter((item) => item.competencyId === request.question.competencyId && item.followUp).length;
  if (!generated.suggestedFollowUp || priorFollowUps >= 2 || generated.score >= 78) return undefined;
  return {
    id: `${request.question.id}-follow-up-${priorFollowUps + 1}`,
    competencyId: request.question.competencyId,
    kind: "adaptive_follow_up",
    prompt: generated.suggestedFollowUp.slice(0, 600),
    rationale: `The previous answer scored ${Math.round(generated.score)}/100 and needs clarification: ${generated.missingSignals.slice(0, 2).join(", ") || "technical specificity"}.`,
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
    "You are evaluating technical substance, not speaking style. Judge whether the answer demonstrates firsthand understanding through specific implementation details, sound trade-offs, failure awareness, and validation. Compare the answer with the supplied public evidence, but never treat missing public evidence as proof of dishonesty. Do not use accent, grammar, verbosity, confidence, personality, demographic proxies, or culture fit. Use needs_human_review when the transcript is ambiguous or insufficient. Suggested follow-up must be one concise spoken question targeting the most important missing technical signal, or null when verification is sufficient.",
    {
      competency: { name: competency.competency.name, description: competency.competency.description, required: competency.competency.required },
      question: request.question,
      answer: request.answer.slice(0, 12000),
      evidence: competency.evidence.map((item) => ({ id: item.id, name: item.name, description: item.description, technologies: item.technologies, signals: item.signals, excerpt: item.source.excerpt })),
      priorEvaluations: (request.previousEvaluations ?? []).filter((item) => item.competencyId === request.question.competencyId).map((item) => ({ score: item.score, rationale: item.rationale, missingSignals: item.missingSignals })),
    },
  ) ?? fallbackEvaluation(request);
  const safeScore = Math.max(0, Math.min(100, Math.round(generated.score)));
  const safeConfidence = Math.max(0, Math.min(1, generated.confidence));
  const status: VerificationStatus = generated.status === "needs_human_review" || safeConfidence < 0.35 ? "needs_human_review" : safeScore >= 72 ? "verified" : safeScore >= 45 ? "partially_verified" : "unverified";
  const safeGenerated = { ...generated, score: safeScore, confidence: safeConfidence, status };
  return {
    questionId: request.question.id,
    competencyId: request.question.competencyId,
    answer: request.answer.slice(0, 12000),
    score: safeScore,
    status,
    confidence: safeConfidence,
    demonstratedSignals: generated.demonstratedSignals.slice(0, 8),
    missingSignals: generated.missingSignals.slice(0, 8),
    rationale: generated.rationale.slice(0, 1200),
    evidenceRefs: request.question.evidenceRefs,
    followUp: createFollowUp(request, safeGenerated),
  };
}
