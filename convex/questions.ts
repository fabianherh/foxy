import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail, requireText } from "./utils";
import { questionInputValidator } from "./validators";

export const saveQuestions = mutation({
  args: {
    interviewId: v.id("interviews"),
    questions: v.array(questionInputValidator),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get(args.interviewId);
    if (!interview) {
      fail("NOT_FOUND", "Interview not found");
    }
    if (interview.status !== "pending") {
      fail("INVALID_STATE", "Questions can only be saved for a pending interview");
    }
    if (args.questions.length === 0) {
      fail("INVALID_ARGUMENT", "At least one question is required");
    }
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_interview", (q) =>
        q.eq("interviewId", interview._id),
      )
      .first();
    if (answers) {
      fail("CONFLICT", "Questions cannot be replaced after answers exist");
    }
    const existing = await ctx.db
      .query("questions")
      .withIndex("by_interview", (q) =>
        q.eq("interviewId", interview._id),
      )
      .collect();
    for (const question of existing) {
      await ctx.db.delete(question._id);
    }
    const questionIds = [];
    for (const [order, input] of args.questions.entries()) {
      if (input.evidenceId) {
        const evidence = await ctx.db.get(input.evidenceId);
        if (!evidence || evidence.candidateId !== interview.candidateId) {
          fail("INVALID_ARGUMENT", "Question evidence belongs to another candidate");
        }
      }
      questionIds.push(
        await ctx.db.insert("questions", {
          interviewId: interview._id,
          candidateId: interview.candidateId,
          competency: requireText(input.competency, "competency"),
          question: requireText(input.question, "question"),
          reason: requireText(input.reason, "reason"),
          evidenceId: input.evidenceId,
          order,
          status: "pending",
        }),
      );
    }
    await ctx.db.patch(interview._id, { currentQuestionIndex: 0 });
    return questionIds;
  },
});

export const getInterviewQuestions = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("questions")
      .withIndex("by_interview", (q) =>
        q.eq("interviewId", args.interviewId),
      )
      .order("asc")
      .collect(),
});

export const markQuestionAsked = mutation({
  args: { questionId: v.id("questions") },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      fail("NOT_FOUND", "Question not found");
    }
    if (question.status === "answered" || question.status === "skipped") {
      fail("INVALID_STATE", `Cannot ask a ${question.status} question`);
    }
    const interview = await ctx.db.get(question.interviewId);
    if (!interview) {
      fail("NOT_FOUND", "Interview not found");
    }
    if (interview.status !== "active") {
      fail("INVALID_STATE", "Interview must be active");
    }
    await ctx.db.patch(question._id, { status: "asked" });
    await ctx.db.patch(interview._id, {
      currentQuestionIndex: question.order,
    });
    return question._id;
  },
});
