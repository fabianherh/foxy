import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const applicationStatus = v.union(
  v.literal("invited"),
  v.literal("profile_started"),
  v.literal("analyzing"),
  v.literal("generating_questions"),
  v.literal("ready"),
  v.literal("in_progress"),
  v.literal("grading"),
  v.literal("completed"),
  v.literal("failed"),
);

export default defineSchema({
  ...authTables,
  recruiterProfiles: defineTable({ userId: v.id("users"), email: v.string(), companyName: v.string(), createdAt: v.number() }).index("by_user", ["userId"]),
  jobPostings: defineTable({ ownerId: v.id("users"), title: v.string(), description: v.optional(v.string()), competencies: v.any(), status: v.union(v.literal("draft"), v.literal("open"), v.literal("closed")), createdAt: v.number() }).index("by_owner", ["ownerId"]),
  applications: defineTable({ jobPostingId: v.id("jobPostings"), inviteToken: v.string(), status: applicationStatus, candidateId: v.optional(v.id("candidates")), error: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number() }).index("by_job", ["jobPostingId"]).index("by_token", ["inviteToken"]),
  candidates: defineTable({ applicationId: v.id("applications"), name: v.string(), githubUrl: v.string(), cvText: v.optional(v.string()), createdAt: v.number() }).index("by_application", ["applicationId"]),
  scrapedContexts: defineTable({ applicationId: v.id("applications"), provider: v.string(), data: v.any(), createdAt: v.number() }).index("by_application", ["applicationId"]),
  questions: defineTable({ applicationId: v.id("applications"), sequence: v.number(), data: v.any(), createdAt: v.number() }).index("by_application", ["applicationId"]),
  answers: defineTable({ applicationId: v.id("applications"), questionId: v.string(), transcript: v.string(), evaluation: v.any(), createdAt: v.number() }).index("by_application", ["applicationId"]),
  results: defineTable({ applicationId: v.id("applications"), overallScore: v.number(), recommendation: v.string(), data: v.any(), createdAt: v.number() }).index("by_application", ["applicationId"]),
  recordings: defineTable({ applicationId: v.id("applications"), type: v.union(v.literal("camera"), v.literal("screen")), storageId: v.id("_storage"), mimeType: v.string(), size: v.number(), durationMs: v.number(), createdAt: v.number() }).index("by_application", ["applicationId"]),
});
