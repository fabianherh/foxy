import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail, requireText, score, stringList } from "./utils";
import { reportFields } from "./validators";

export const saveReport = mutation({
  args: {
    candidateId: v.id("candidates"),
    interviewId: v.id("interviews"),
    ...reportFields,
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      fail("NOT_FOUND", "Candidate not found");
    }
    const interview = await ctx.db.get(args.interviewId);
    if (!interview || interview.candidateId !== candidate._id) {
      fail("INVALID_ARGUMENT", "Interview does not belong to this candidate");
    }
    if (interview.status !== "completed") {
      fail("INVALID_STATE", "A final report requires a completed interview");
    }
    const report = {
      candidateId: candidate._id,
      interviewId: interview._id,
      recommendation: args.recommendation,
      overallScore: score(args.overallScore, "overallScore"),
      technicalScore: score(args.technicalScore, "technicalScore"),
      evidenceScore: score(args.evidenceScore, "evidenceScore"),
      strengths: stringList(args.strengths, "strengths"),
      concerns: stringList(args.concerns, "concerns"),
      summary: requireText(args.summary, "summary"),
    };
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_interview", (q) =>
        q.eq("interviewId", interview._id),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, report);
      return existing._id;
    }
    return await ctx.db.insert("reports", {
      ...report,
      createdAt: Date.now(),
    });
  },
});

export const getCandidateReport = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("reports")
      .withIndex("by_candidate", (q) =>
        q.eq("candidateId", args.candidateId),
      )
      .order("desc")
      .first(),
});
