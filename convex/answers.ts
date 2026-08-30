import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { confidence, fail, requireText, score } from "./utils";
import { answerFields } from "./validators";

export const saveAnswer = mutation({
  args: {
    interviewId: v.id("interviews"),
    questionId: v.id("questions"),
    ...answerFields,
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get(args.interviewId);
    if (!interview) {
      fail("NOT_FOUND", "Interview not found");
    }
    if (interview.status !== "active") {
      fail("INVALID_STATE", "Interview must be active to save an answer");
    }
    const question = await ctx.db.get(args.questionId);
    if (!question || question.interviewId !== interview._id) {
      fail("INVALID_ARGUMENT", "Question does not belong to this interview");
    }
    const existing = await ctx.db
      .query("answers")
      .withIndex("by_question", (q) => q.eq("questionId", question._id))
      .first();
    if (
      question.status !== "asked" &&
      !(question.status === "answered" && existing)
    ) {
      fail("INVALID_STATE", `Cannot answer a ${question.status} question`);
    }
    const answer = {
      transcript: requireText(args.transcript, "transcript"),
      score: score(args.score, "score"),
      evaluation: requireText(args.evaluation, "evaluation"),
      confidence: confidence(args.confidence),
    };
    let answerId;
    if (existing) {
      await ctx.db.patch(existing._id, answer);
      answerId = existing._id;
    } else {
      answerId = await ctx.db.insert("answers", {
        interviewId: interview._id,
        questionId: question._id,
        candidateId: interview.candidateId,
        ...answer,
        createdAt: Date.now(),
      });
    }
    await ctx.db.patch(question._id, { status: "answered" });
    const [questions, answers] = await Promise.all([
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
    ]);
    const answeredIds = new Set(answers.map((item) => item.questionId));
    const nextQuestion = questions.find(
      (item) => !answeredIds.has(item._id),
    );
    if (nextQuestion) {
      if (nextQuestion.status === "pending") {
        await ctx.db.patch(nextQuestion._id, { status: "asked" });
      }
      await ctx.db.patch(interview._id, {
        currentQuestionIndex: nextQuestion.order,
      });
    } else {
      await ctx.db.patch(interview._id, {
        currentQuestionIndex: questions.length,
      });
    }
    return answerId;
  },
});

export const getInterviewAnswers = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const [answers, questions] = await Promise.all([
      ctx.db
        .query("answers")
        .withIndex("by_interview", (q) =>
          q.eq("interviewId", args.interviewId),
        )
        .collect(),
      ctx.db
        .query("questions")
        .withIndex("by_interview", (q) =>
          q.eq("interviewId", args.interviewId),
        )
        .collect(),
    ]);
    const order = new Map(questions.map((question) => [question._id, question.order]));
    return [...answers].sort(
      (left, right) =>
        (order.get(left.questionId) ?? 0) -
        (order.get(right.questionId) ?? 0),
    );
  },
});
