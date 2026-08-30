import { v } from "convex/values";

export const jobStatusValidator = v.union(
  v.literal("draft"),
  v.literal("open"),
  v.literal("closed"),
);

export const candidateStatusValidator = v.union(
  v.literal("uploaded"),
  v.literal("analyzing"),
  v.literal("ready"),
  v.literal("interviewing"),
  v.literal("completed"),
  v.literal("failed"),
);

export const evidenceStrengthValidator = v.union(
  v.literal("strong"),
  v.literal("medium"),
  v.literal("weak"),
);

export const verificationStatusValidator = v.union(
  v.literal("supported"),
  v.literal("partial"),
  v.literal("unsupported"),
  v.literal("unknown"),
);

export const interviewStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const questionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("asked"),
  v.literal("answered"),
  v.literal("skipped"),
);

export const recommendationValidator = v.union(
  v.literal("advance"),
  v.literal("human_review"),
  v.literal("do_not_advance"),
);

export const evidenceFields = {
  skill: v.string(),
  claim: v.string(),
  source: v.string(),
  evidenceUrl: v.string(),
  evidenceText: v.string(),
  strength: evidenceStrengthValidator,
  verificationStatus: verificationStatusValidator,
};

export const evidenceInputValidator = v.object(evidenceFields);

export const questionInputValidator = v.object({
  competency: v.string(),
  question: v.string(),
  reason: v.string(),
  evidenceId: v.optional(v.id("evidence")),
});

export const answerFields = {
  transcript: v.string(),
  score: v.number(),
  evaluation: v.string(),
  confidence: v.number(),
};

export const reportFields = {
  recommendation: recommendationValidator,
  overallScore: v.number(),
  technicalScore: v.number(),
  evidenceScore: v.number(),
  strengths: v.array(v.string()),
  concerns: v.array(v.string()),
  summary: v.string(),
};
