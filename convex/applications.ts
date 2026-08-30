import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function requireUser(ctx: Pick<MutationCtx | QueryCtx, "auth">) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Authentication required");
  return userId;
}

export const ensureRecruiterProfile = mutation({
  args: { companyName: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db.query("recruiterProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (existing) return existing._id;
    const user = await ctx.db.get(userId);
    return await ctx.db.insert("recruiterProfiles", { userId, email: user?.email ?? "", companyName: args.companyName.trim() || "Demo Company", createdAt: Date.now() });
  },
});

export const createJob = mutation({
  args: { title: v.string(), description: v.optional(v.string()), competencies: v.any() },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    if (!args.title.trim()) throw new Error("Job title is required");
    if (!Array.isArray(args.competencies) || !args.competencies.length) throw new Error("At least one competency is required");
    return await ctx.db.insert("jobPostings", { ownerId, title: args.title.trim(), description: args.description?.trim(), competencies: args.competencies, status: "open", createdAt: Date.now() });
  },
});

export const createInvite = mutation({
  args: { jobPostingId: v.id("jobPostings"), inviteToken: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const job = await ctx.db.get(args.jobPostingId);
    if (!job || job.ownerId !== ownerId) throw new Error("Job not found");
    if (args.inviteToken.length < 32) throw new Error("Invite token is too short");
    const existing = await ctx.db.query("applications").withIndex("by_token", (q) => q.eq("inviteToken", args.inviteToken)).unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("applications", { jobPostingId: args.jobPostingId, inviteToken: args.inviteToken, status: "invited", createdAt: now, updatedAt: now });
  },
});

export const recruiterDashboard = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUser(ctx);
    const jobs = await ctx.db.query("jobPostings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).order("desc").collect();
    return await Promise.all(jobs.map(async (job) => {
      const applications = await ctx.db.query("applications").withIndex("by_job", (q) => q.eq("jobPostingId", job._id)).order("desc").collect();
      return {
        ...job,
        applications: await Promise.all(applications.map(async (application) => {
          const [candidate, result, recordings] = await Promise.all([
            application.candidateId ? ctx.db.get(application.candidateId) : null,
            ctx.db.query("results").withIndex("by_application", (q) => q.eq("applicationId", application._id)).order("desc").first(),
            ctx.db.query("recordings").withIndex("by_application", (q) => q.eq("applicationId", application._id)).collect(),
          ]);
          return {
            _id: application._id,
            status: application.status,
            inviteToken: application.inviteToken,
            updatedAt: application.updatedAt,
            candidate,
            result,
            recordings: await Promise.all(recordings.map(async (recording) => ({ type: recording.type, url: await ctx.storage.getUrl(recording.storageId), durationMs: recording.durationMs }))),
          };
        })),
      };
    }));
  },
});

export const listOpenJobs = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobPostings").order("desc").collect();
    return jobs.filter((job) => job.status === "open").map((job) => ({ _id: job._id, title: job.title, description: job.description, competencyCount: Array.isArray(job.competencies) ? job.competencies.length : 0 }));
  },
});

export const applyToJob = mutation({
  args: { jobPostingId: v.id("jobPostings"), inviteToken: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobPostingId);
    if (!job || job.status !== "open") throw new Error("This role is no longer open");
    if (args.inviteToken.length < 32) throw new Error("Invalid application token");
    const existing = await ctx.db.query("applications").withIndex("by_token", (q) => q.eq("inviteToken", args.inviteToken)).unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("applications", { jobPostingId: args.jobPostingId, inviteToken: args.inviteToken, status: "invited", createdAt: now, updatedAt: now });
  },
});

export const getByInvite = query({
  args: { inviteToken: v.string() },
  handler: async (ctx, args) => {
    const application = await ctx.db.query("applications").withIndex("by_token", (q) => q.eq("inviteToken", args.inviteToken)).unique();
    if (!application) return null;
    const job = await ctx.db.get(application.jobPostingId);
    const candidate = application.candidateId ? await ctx.db.get(application.candidateId) : null;
    return { applicationId: application._id, status: application.status, error: application.error, job: job ? { _id: job._id, title: job.title, description: job.description, competencies: job.competencies } : null, candidate };
  },
});

export const submitCandidateProfile = mutation({
  args: { inviteToken: v.string(), name: v.string(), githubUrl: v.string(), cvText: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const application = await ctx.db.query("applications").withIndex("by_token", (q) => q.eq("inviteToken", args.inviteToken)).unique();
    if (!application) throw new Error("Invalid invitation");
    let candidateId = application.candidateId;
    if (candidateId) await ctx.db.patch(candidateId, { name: args.name, githubUrl: args.githubUrl, cvText: args.cvText });
    else candidateId = await ctx.db.insert("candidates", { applicationId: application._id, name: args.name, githubUrl: args.githubUrl, cvText: args.cvText, createdAt: Date.now() });
    await ctx.db.patch(application._id, { candidateId, status: "analyzing", error: undefined, updatedAt: Date.now() });
    return application._id;
  },
});

export const getForAnalysis = internalQuery({
  args: { applicationId: v.id("applications"), inviteToken: v.string() },
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.inviteToken !== args.inviteToken) throw new Error("Invalid invitation");
    if (!application.candidateId) throw new Error("Candidate profile is missing");
    const candidate = await ctx.db.get(application.candidateId);
    const job = await ctx.db.get(application.jobPostingId);
    if (!candidate || !job) throw new Error("Application data is missing");
    return { application, candidate, job };
  },
});

export const storeAnalysis = internalMutation({
  args: { applicationId: v.id("applications"), intelligence: v.any(), questions: v.any() },
  handler: async (ctx, args) => {
    const existingContexts = await ctx.db.query("scrapedContexts").withIndex("by_application", (q) => q.eq("applicationId", args.applicationId)).order("desc").collect();
    if (existingContexts[0]) await ctx.db.patch(existingContexts[0]._id, { provider: args.intelligence.webEvidence.provider, data: args.intelligence, createdAt: Date.now() });
    else await ctx.db.insert("scrapedContexts", { applicationId: args.applicationId, provider: args.intelligence.webEvidence.provider, data: args.intelligence, createdAt: Date.now() });
    const existingQuestions = await ctx.db.query("questions").withIndex("by_application", (q) => q.eq("applicationId", args.applicationId)).collect();
    for (const question of args.questions) {
      const existing = existingQuestions.find((item) => item.data.id === question.id);
      if (existing) await ctx.db.patch(existing._id, { sequence: question.sequence, data: question, createdAt: Date.now() });
      else await ctx.db.insert("questions", { applicationId: args.applicationId, sequence: question.sequence, data: question, createdAt: Date.now() });
    }
    await ctx.db.patch(args.applicationId, { status: "ready", updatedAt: Date.now() });
  },
});

export const markFailed = internalMutation({
  args: { applicationId: v.id("applications"), error: v.string() },
  handler: async (ctx, args) => await ctx.db.patch(args.applicationId, { status: "failed", error: args.error.slice(0, 500), updatedAt: Date.now() }),
});

export const getInterviewData = internalQuery({
  args: { applicationId: v.id("applications"), inviteToken: v.string() },
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.inviteToken !== args.inviteToken) throw new Error("Invalid invitation");
    const context = await ctx.db.query("scrapedContexts").withIndex("by_application", (q) => q.eq("applicationId", args.applicationId)).order("desc").first();
    const questionRows = await ctx.db.query("questions").withIndex("by_application", (q) => q.eq("applicationId", args.applicationId)).order("desc").collect();
    const answerRows = await ctx.db.query("answers").withIndex("by_application", (q) => q.eq("applicationId", args.applicationId)).order("desc").collect();
    if (!context) throw new Error("Analysis is missing");
    const questions = [...new Map(questionRows.map((item) => [item.data.id, item])).values()].sort((a, b) => a.sequence - b.sequence);
    const answers = [...new Map(answerRows.map((item) => [item.questionId, item])).values()];
    return { intelligence: context.data, questions, answers };
  },
});

export const storeAnswer = internalMutation({
  args: { applicationId: v.id("applications"), questionId: v.string(), transcript: v.string(), evaluation: v.any() },
  handler: async (ctx, args) => {
    const existingAnswers = await ctx.db.query("answers").withIndex("by_application", (q) => q.eq("applicationId", args.applicationId)).order("desc").collect();
    const existingAnswer = existingAnswers.find((item) => item.questionId === args.questionId);
    if (existingAnswer) await ctx.db.patch(existingAnswer._id, { transcript: args.transcript, evaluation: args.evaluation, createdAt: Date.now() });
    else await ctx.db.insert("answers", { ...args, createdAt: Date.now() });
    if (args.evaluation.followUp) {
      const existingQuestions = await ctx.db.query("questions").withIndex("by_application", (q) => q.eq("applicationId", args.applicationId)).collect();
      const existingFollowUp = existingQuestions.find((item) => item.data.id === args.evaluation.followUp.id);
      if (existingFollowUp) await ctx.db.patch(existingFollowUp._id, { sequence: args.evaluation.followUp.sequence, data: args.evaluation.followUp });
      else await ctx.db.insert("questions", { applicationId: args.applicationId, sequence: args.evaluation.followUp.sequence, data: args.evaluation.followUp, createdAt: Date.now() });
    }
    await ctx.db.patch(args.applicationId, { status: "in_progress", updatedAt: Date.now() });
  },
});

export const storeResult = internalMutation({
  args: { applicationId: v.id("applications"), result: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("results").withIndex("by_application", (q) => q.eq("applicationId", args.applicationId)).order("desc").first();
    const result = { overallScore: args.result.overallScore, recommendation: args.result.recommendation, data: args.result, createdAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, result);
    else await ctx.db.insert("results", { applicationId: args.applicationId, ...result });
    await ctx.db.patch(args.applicationId, { status: "completed", updatedAt: Date.now() });
  },
});
