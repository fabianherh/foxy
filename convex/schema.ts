import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  candidateStatusValidator,
  evidenceStrengthValidator,
  interviewStatusValidator,
  jobStatusValidator,
  questionStatusValidator,
  recommendationValidator,
  verificationStatusValidator,
} from "./validators";

export default defineSchema({
  jobs: defineTable({
    title: v.string(),
    description: v.string(),
    requiredSkills: v.array(v.string()),
    experienceLevel: v.string(),
    status: jobStatusValidator,
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  candidates: defineTable({
    jobId: v.id("jobs"),
    name: v.string(),
    email: v.optional(v.string()),
    githubUrl: v.string(),
    portfolioUrl: v.optional(v.string()),
    cvStorageId: v.optional(v.id("_storage")),
    status: candidateStatusValidator,
    createdAt: v.number(),
  }).index("by_job", ["jobId"]),

  evidence: defineTable({
    candidateId: v.id("candidates"),
    skill: v.string(),
    claim: v.string(),
    source: v.string(),
    evidenceUrl: v.string(),
    evidenceText: v.string(),
    strength: evidenceStrengthValidator,
    verificationStatus: verificationStatusValidator,
    createdAt: v.number(),
  })
    .index("by_candidate", ["candidateId"])
    .index("by_candidate_skill", ["candidateId", "skill"]),

  interviews: defineTable({
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    status: interviewStatusValidator,
    currentQuestionIndex: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_candidate", ["candidateId"])
    .index("by_job", ["jobId"]),

  questions: defineTable({
    interviewId: v.id("interviews"),
    candidateId: v.id("candidates"),
    competency: v.string(),
    question: v.string(),
    reason: v.string(),
    evidenceId: v.optional(v.id("evidence")),
    order: v.number(),
    status: questionStatusValidator,
  }).index("by_interview", ["interviewId", "order"]),

  answers: defineTable({
    interviewId: v.id("interviews"),
    questionId: v.id("questions"),
    candidateId: v.id("candidates"),
    transcript: v.string(),
    score: v.number(),
    evaluation: v.string(),
    confidence: v.number(),
    createdAt: v.number(),
  })
    .index("by_interview", ["interviewId"])
    .index("by_question", ["questionId"]),

  reports: defineTable({
    candidateId: v.id("candidates"),
    interviewId: v.id("interviews"),
    recommendation: recommendationValidator,
    overallScore: v.number(),
    technicalScore: v.number(),
    evidenceScore: v.number(),
    strengths: v.array(v.string()),
    concerns: v.array(v.string()),
    summary: v.string(),
    createdAt: v.number(),
  })
    .index("by_candidate", ["candidateId"])
    .index("by_interview", ["interviewId"]),

  demoSessions: defineTable({
    key: v.string(),
    jobId: v.id("jobs"),
    candidateId: v.id("candidates"),
    interviewId: v.id("interviews"),
    createdAt: v.number(),
  }).index("by_key", ["key"]),
});
