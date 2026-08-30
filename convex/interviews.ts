import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail } from "./utils";

export const createInterview = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      fail("NOT_FOUND", "Candidate not found");
    }
    if (!(await ctx.db.get(args.jobId))) {
      fail("NOT_FOUND", "Job not found");
    }
    if (candidate.jobId !== args.jobId) {
      fail("INVALID_ARGUMENT", "Candidate does not belong to this job");
    }
    return await ctx.db.insert("interviews", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      status: "pending",
      currentQuestionIndex: 0,
    });
  },
});

export const startInterview = mutation({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get(args.interviewId);
    if (!interview) {
      fail("NOT_FOUND", "Interview not found");
    }
    if (interview.status === "completed" || interview.status === "cancelled") {
      fail("INVALID_STATE", `Cannot start a ${interview.status} interview`);
    }
    if (interview.status === "active") {
      return interview._id;
    }
    const firstQuestion = await ctx.db
      .query("questions")
      .withIndex("by_interview", (q) =>
        q.eq("interviewId", interview._id),
      )
      .order("asc")
      .first();
    const startedAt = Date.now();
    await ctx.db.patch(interview._id, {
      status: "active",
      currentQuestionIndex: firstQuestion?.order ?? 0,
      startedAt,
    });
    await ctx.db.patch(interview.candidateId, { status: "interviewing" });
    if (firstQuestion?.status === "pending") {
      await ctx.db.patch(firstQuestion._id, { status: "asked" });
    }
    return interview._id;
  },
});

export const getInterview = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => await ctx.db.get(args.interviewId),
});

export const completeInterview = mutation({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get(args.interviewId);
    if (!interview) {
      fail("NOT_FOUND", "Interview not found");
    }
    if (interview.status === "completed") {
      return interview._id;
    }
    if (interview.status !== "active") {
      fail("INVALID_STATE", "Only an active interview can be completed");
    }
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_interview", (q) =>
        q.eq("interviewId", interview._id),
      )
      .collect();
    if (
      questions.length === 0 ||
      questions.some((question) => question.status !== "answered")
    ) {
      fail("INVALID_STATE", "All interview questions must be answered");
    }
    await ctx.db.patch(interview._id, {
      status: "completed",
      completedAt: Date.now(),
    });
    await ctx.db.patch(interview.candidateId, { status: "completed" });
    return interview._id;
  },
});
