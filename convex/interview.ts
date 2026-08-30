"use node";

import { v } from "convex/values";
import { analyzeCandidate } from "../src/lib/intelligence/engine";
import { evaluateAnswer } from "../src/lib/intelligence/evaluation";
import { buildTechnicalAssessment } from "../src/lib/intelligence/report";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

export const analyzeApplication = action({
  args: { applicationId: v.id("applications"), inviteToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const { candidate, job } = await ctx.runQuery(internal.applications.getForAnalysis, args);
      const result = await analyzeCandidate({
        candidate: { id: candidate._id, name: candidate.name, githubUrl: candidate.githubUrl, cvText: candidate.cvText ?? "" },
        role: { id: job._id, title: job.title, competencies: job.competencies },
      });
      await ctx.runMutation(internal.applications.storeAnalysis, { applicationId: args.applicationId, intelligence: result.intelligence, questions: result.questions });
      return { questions: result.questions, intelligence: result.intelligence };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      await ctx.runMutation(internal.applications.markFailed, { applicationId: args.applicationId, error: message });
      throw error;
    }
  },
});

export const evaluateApplicationAnswer = action({
  args: { applicationId: v.id("applications"), inviteToken: v.string(), questionId: v.string(), answer: v.string() },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.applications.getInterviewData, { applicationId: args.applicationId, inviteToken: args.inviteToken });
    const question = data.questions.find((item) => item.data.id === args.questionId)?.data;
    if (!question) throw new Error("Question not found");
    const previousEvaluations = data.answers.map((item) => item.evaluation);
    const evaluation = await evaluateAnswer({ intelligence: data.intelligence, question, answer: args.answer, previousEvaluations });
    await ctx.runMutation(internal.applications.storeAnswer, { applicationId: args.applicationId, questionId: args.questionId, transcript: args.answer, evaluation });
    return evaluation;
  },
});

export const finalizeApplication = action({
  args: { applicationId: v.id("applications"), inviteToken: v.string() },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.applications.getInterviewData, args);
    const result = await buildTechnicalAssessment(data.intelligence, data.answers.map((item) => item.evaluation));
    await ctx.runMutation(internal.applications.storeResult, { applicationId: args.applicationId, result });
    return result;
  },
});
