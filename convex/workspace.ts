import { v } from "convex/values";
import { query } from "./_generated/server";

export const getCandidateWorkspace = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      return null;
    }
    const [job, evidence, interview] = await Promise.all([
      ctx.db.get(candidate.jobId),
      ctx.db
        .query("evidence")
        .withIndex("by_candidate", (q) =>
          q.eq("candidateId", candidate._id),
        )
        .collect(),
      ctx.db
        .query("interviews")
        .withIndex("by_candidate", (q) =>
          q.eq("candidateId", candidate._id),
        )
        .order("desc")
        .first(),
    ]);
    if (!interview) {
      const report = await ctx.db
        .query("reports")
        .withIndex("by_candidate", (q) =>
          q.eq("candidateId", candidate._id),
        )
        .order("desc")
        .first();
      return {
        candidate,
        job,
        evidence,
        interview: null,
        questions: [],
        answers: [],
        report,
      };
    }
    const [questions, answers, report] = await Promise.all([
      ctx.db
        .query("questions")
        .withIndex("by_interview", (q) =>
          q.eq("interviewId", interview._id),
        )
        .order("asc")
        .collect(),
      ctx.db
        .query("answers")
        .withIndex("by_interview", (q) =>
          q.eq("interviewId", interview._id),
        )
        .collect(),
      ctx.db
        .query("reports")
        .withIndex("by_interview", (q) =>
          q.eq("interviewId", interview._id),
        )
        .first(),
    ]);
    const questionOrder = new Map(
      questions.map((question) => [question._id, question.order]),
    );
    const orderedAnswers = [...answers].sort(
      (left, right) =>
        (questionOrder.get(left.questionId) ?? 0) -
        (questionOrder.get(right.questionId) ?? 0),
    );
    return {
      candidate,
      job,
      evidence,
      interview,
      questions,
      answers: orderedAnswers,
      report,
    };
  },
});
