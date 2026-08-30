import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  fail,
  optionalEmail,
  optionalHttpUrl,
  requireHttpUrl,
  requireText,
} from "./utils";
import { candidateStatusValidator } from "./validators";

export const createCandidate = mutation({
  args: {
    jobId: v.id("jobs"),
    name: v.string(),
    email: v.optional(v.string()),
    githubUrl: v.string(),
    portfolioUrl: v.optional(v.string()),
    cvStorageId: v.optional(v.id("_storage")),
    status: v.optional(candidateStatusValidator),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.jobId))) {
      fail("NOT_FOUND", "Job not found");
    }
    return await ctx.db.insert("candidates", {
      jobId: args.jobId,
      name: requireText(args.name, "name"),
      email: optionalEmail(args.email),
      githubUrl: requireHttpUrl(args.githubUrl, "githubUrl"),
      portfolioUrl: optionalHttpUrl(args.portfolioUrl, "portfolioUrl"),
      cvStorageId: args.cvStorageId,
      status: args.status ?? "uploaded",
      createdAt: Date.now(),
    });
  },
});

export const getCandidate = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => await ctx.db.get(args.candidateId),
});

export const listCandidatesByJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("candidates")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .collect(),
});

export const updateCandidateStatus = mutation({
  args: {
    candidateId: v.id("candidates"),
    status: candidateStatusValidator,
  },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.candidateId))) {
      fail("NOT_FOUND", "Candidate not found");
    }
    await ctx.db.patch(args.candidateId, { status: args.status });
    return args.candidateId;
  },
});
