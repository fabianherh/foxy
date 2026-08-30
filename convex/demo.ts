import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { fail } from "./utils";

const DEMO_KEY = "foxy-primary-demo";

const demoEvidence = [
  {
    skill: "React",
    claim: "Built production React applications",
    source: "github",
    evidenceUrl: "https://github.com/foxy-demo/maya-commerce/tree/main/apps/web",
    evidenceText: "A component-driven storefront with route-level code splitting, tests, and accessible interaction patterns.",
    strength: "strong" as const,
    verificationStatus: "supported" as const,
  },
  {
    skill: "TypeScript",
    claim: "Uses TypeScript for reliable application boundaries",
    source: "github",
    evidenceUrl: "https://github.com/foxy-demo/maya-commerce/tree/main/packages/contracts",
    evidenceText: "Shared discriminated unions and runtime schemas are used by the web and API packages.",
    strength: "strong" as const,
    verificationStatus: "supported" as const,
  },
  {
    skill: "Node.js",
    claim: "Designed Node.js services for production workloads",
    source: "github",
    evidenceUrl: "https://github.com/foxy-demo/maya-commerce/tree/main/apps/api",
    evidenceText: "The API demonstrates bounded modules, idempotent handlers, structured logging, and background jobs.",
    strength: "medium" as const,
    verificationStatus: "supported" as const,
  },
  {
    skill: "PostgreSQL",
    claim: "Can model and optimize relational data",
    source: "portfolio",
    evidenceUrl: "https://foxy-demo.dev/case-studies/commerce-platform",
    evidenceText: "The case study describes indexes and transaction boundaries, but does not expose production query plans.",
    strength: "medium" as const,
    verificationStatus: "partial" as const,
  },
  {
    skill: "AWS",
    claim: "Has deployed and operated workloads on AWS",
    source: "cv",
    evidenceUrl: "https://foxy-demo.dev/resume",
    evidenceText: "AWS deployment is claimed on the CV, with limited public infrastructure or operational evidence.",
    strength: "weak" as const,
    verificationStatus: "unknown" as const,
  },
];

const demoQuestions = [
  {
    competency: "React",
    question: "Your repository splits the storefront by route. What user-facing problem justified that boundary, and how did you verify it improved performance?",
    reason: "Challenges a strong React performance claim with evidence from the storefront.",
    evidenceIndex: 0,
  },
  {
    competency: "TypeScript",
    question: "Describe a failure that your shared discriminated unions prevent. Where does compile-time safety end and runtime validation begin?",
    reason: "Verifies that the candidate understands the limits of TypeScript across service boundaries.",
    evidenceIndex: 1,
  },
  {
    competency: "Node.js",
    question: "How would you make an order-creation endpoint idempotent when clients retry during a timeout?",
    reason: "Tests backend reliability against the candidate's Node.js service evidence.",
    evidenceIndex: 2,
  },
  {
    competency: "PostgreSQL",
    question: "A query filtering orders by tenant and status becomes slow at scale. How would you diagnose it and choose an index?",
    reason: "Challenges partially verified PostgreSQL optimization experience.",
    evidenceIndex: 3,
  },
  {
    competency: "AWS",
    question: "Walk through the minimum AWS architecture you would use to deploy this API safely, including secrets, observability, and rollback.",
    reason: "Seeks concrete verification for a weak, publicly unverified AWS claim.",
    evidenceIndex: 4,
  },
];

const demoAnswers = [
  {
    transcript: "The product image bundle delayed interaction on mobile. I separated the catalog and checkout routes, measured p75 LCP before and after in production, and used bundle analysis to ensure the gain came from fewer initial bytes rather than cache noise.",
    score: 91,
    evaluation: "Connects an implementation decision to a measured user outcome and names an appropriate validation method.",
    confidence: 0.94,
  },
  {
    transcript: "The union prevents impossible order-state handling in our application code, but JSON is still untrusted. We validate payloads at the API boundary, convert them into the domain type, and keep exhaustive checks inside the service.",
    score: 93,
    evaluation: "Clearly distinguishes static guarantees from runtime trust boundaries.",
    confidence: 0.96,
  },
  {
    transcript: "I would require an idempotency key scoped to the account, store it with the resulting order in the same transaction, and return the original result on retries. A unique constraint handles concurrent duplicate requests.",
    score: 88,
    evaluation: "Provides a correct transactional design and addresses concurrent retries.",
    confidence: 0.92,
  },
  {
    transcript: "I would capture the real query and parameters, run EXPLAIN ANALYZE on production-like data, and inspect row estimates and reads. A likely index starts with tenant then status, but I would consider selectivity and whether a partial index is justified.",
    score: 82,
    evaluation: "Shows a sound diagnosis process while appropriately avoiding an index prescription without data.",
    confidence: 0.89,
  },
  {
    transcript: "I would start with a managed container service behind a load balancer, a managed database in private subnets, IAM roles instead of static keys, Secrets Manager, centralized logs and alarms, and immutable revisions so the previous version can receive traffic during rollback.",
    score: 72,
    evaluation: "Covers the major deployment controls, but gives limited detail on network policy and operational ownership.",
    confidence: 0.84,
  },
];

const demoReport = {
  recommendation: "advance" as const,
  overallScore: 86,
  technicalScore: 85,
  evidenceScore: 87,
  strengths: [
    "Strong React and TypeScript evidence",
    "Explains reliability trade-offs with concrete mechanisms",
    "Uses measurement before prescribing optimizations",
  ],
  concerns: [
    "AWS depth is less evidenced than application engineering depth",
    "PostgreSQL production-scale claims need human follow-up",
  ],
  summary: "Maya consistently connected public implementation evidence to sound engineering decisions. Advance to a human interview focused on cloud operations and production database ownership.",
};

async function deleteCandidateGraph(
  ctx: MutationCtx,
  candidateId: Id<"candidates">,
): Promise<number> {
  let deleted = 0;
  const interviews = await ctx.db
    .query("interviews")
    .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))
    .collect();
  for (const interview of interviews) {
    const [questions, answers] = await Promise.all([
      ctx.db
        .query("questions")
        .withIndex("by_interview", (q) => q.eq("interviewId", interview._id))
        .collect(),
      ctx.db
        .query("answers")
        .withIndex("by_interview", (q) => q.eq("interviewId", interview._id))
        .collect(),
    ]);
    for (const answer of answers) {
      await ctx.db.delete(answer._id);
      deleted += 1;
    }
    for (const question of questions) {
      await ctx.db.delete(question._id);
      deleted += 1;
    }
    await ctx.db.delete(interview._id);
    deleted += 1;
  }
  const [evidence, reports] = await Promise.all([
    ctx.db
      .query("evidence")
      .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))
      .collect(),
    ctx.db
      .query("reports")
      .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))
      .collect(),
  ]);
  for (const item of evidence) {
    await ctx.db.delete(item._id);
    deleted += 1;
  }
  for (const report of reports) {
    await ctx.db.delete(report._id);
    deleted += 1;
  }
  const candidate = await ctx.db.get(candidateId);
  if (candidate) {
    if (candidate.cvStorageId) {
      await ctx.storage.delete(candidate.cvStorageId);
    }
    await ctx.db.delete(candidateId);
    deleted += 1;
  }
  return deleted;
}

async function clearDemo(ctx: MutationCtx): Promise<number> {
  const sessions = await ctx.db
    .query("demoSessions")
    .withIndex("by_key", (q) => q.eq("key", DEMO_KEY))
    .collect();
  let deleted = 0;
  for (const session of sessions) {
    deleted += await deleteCandidateGraph(ctx, session.candidateId);
    if (await ctx.db.get(session.jobId)) {
      await ctx.db.delete(session.jobId);
      deleted += 1;
    }
    await ctx.db.delete(session._id);
    deleted += 1;
  }
  return deleted;
}

async function writeDemoReport(
  ctx: MutationCtx,
  candidateId: Id<"candidates">,
  interviewId: Id<"interviews">,
) {
  const existing = await ctx.db
    .query("reports")
    .withIndex("by_interview", (q) => q.eq("interviewId", interviewId))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, demoReport);
    return existing._id;
  }
  return await ctx.db.insert("reports", {
    candidateId,
    interviewId,
    ...demoReport,
    createdAt: Date.now(),
  });
}

async function createDemo(ctx: MutationCtx, completed: boolean) {
  await clearDemo(ctx);
  const now = Date.now();
  const jobId = await ctx.db.insert("jobs", {
    title: "Full Stack Software Engineer",
    description: "Build reliable TypeScript products across a React frontend, Node.js services, PostgreSQL, and AWS.",
    requiredSkills: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS"],
    experienceLevel: "Mid-Senior",
    status: "open",
    createdAt: now,
  });
  const candidateId = await ctx.db.insert("candidates", {
    jobId,
    name: "Maya Chen",
    email: "maya.chen@example.com",
    githubUrl: "https://github.com/foxy-demo-maya",
    portfolioUrl: "https://foxy-demo.dev",
    status: completed ? "completed" : "interviewing",
    createdAt: now,
  });
  const evidenceIds: Id<"evidence">[] = [];
  for (const item of demoEvidence) {
    evidenceIds.push(
      await ctx.db.insert("evidence", {
        candidateId,
        ...item,
        createdAt: now,
      }),
    );
  }
  const interviewId = await ctx.db.insert("interviews", {
    candidateId,
    jobId,
    status: completed ? "completed" : "active",
    currentQuestionIndex: completed ? demoQuestions.length : 0,
    startedAt: now - 20 * 60 * 1000,
    completedAt: completed ? now : undefined,
  });
  const questionIds: Id<"questions">[] = [];
  for (const [order, item] of demoQuestions.entries()) {
    questionIds.push(
      await ctx.db.insert("questions", {
        interviewId,
        candidateId,
        competency: item.competency,
        question: item.question,
        reason: item.reason,
        evidenceId: evidenceIds[item.evidenceIndex],
        order,
        status: completed ? "answered" : order === 0 ? "asked" : "pending",
      }),
    );
  }
  if (completed) {
    for (const [order, answer] of demoAnswers.entries()) {
      await ctx.db.insert("answers", {
        interviewId,
        questionId: questionIds[order],
        candidateId,
        ...answer,
        createdAt: now - (demoAnswers.length - order) * 60 * 1000,
      });
    }
    await writeDemoReport(ctx, candidateId, interviewId);
  }
  await ctx.db.insert("demoSessions", {
    key: DEMO_KEY,
    jobId,
    candidateId,
    interviewId,
    createdAt: now,
  });
  return { jobId, candidateId, interviewId };
}

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => await createDemo(ctx, true),
});

export const createFreshDemoSession = mutation({
  args: {},
  handler: async (ctx) => await createDemo(ctx, false),
});

export const resetDemo = mutation({
  args: {},
  handler: async (ctx) => ({ deleted: await clearDemo(ctx) }),
});

export const demoAnswerNextQuestion = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await ctx.db
      .query("demoSessions")
      .withIndex("by_key", (q) => q.eq("key", DEMO_KEY))
      .first();
    if (!session) {
      fail("NOT_FOUND", "Run createFreshDemoSession before the simulator");
    }
    const interview = await ctx.db.get(session.interviewId);
    if (!interview) {
      fail("NOT_FOUND", "Demo interview not found");
    }
    const [questions, answers] = await Promise.all([
      ctx.db
        .query("questions")
        .withIndex("by_interview", (q) => q.eq("interviewId", interview._id))
        .order("asc")
        .collect(),
      ctx.db
        .query("answers")
        .withIndex("by_interview", (q) => q.eq("interviewId", interview._id))
        .collect(),
    ]);
    const answeredIds = new Set(answers.map((answer) => answer.questionId));
    const question = questions.find((item) => !answeredIds.has(item._id));
    if (!question) {
      return {
        candidateId: session.candidateId,
        interviewId: interview._id,
        answeredQuestionId: null,
        nextQuestionId: null,
        isComplete: interview.status === "completed",
      };
    }
    if (interview.status !== "active") {
      fail("INVALID_STATE", "Demo interview is not active");
    }
    const answer = demoAnswers[question.order];
    if (!answer) {
      fail("INVALID_STATE", "No synthetic answer is configured for this question");
    }
    await ctx.db.insert("answers", {
      interviewId: interview._id,
      questionId: question._id,
      candidateId: interview.candidateId,
      ...answer,
      createdAt: Date.now(),
    });
    await ctx.db.patch(question._id, { status: "answered" });
    const nextQuestion = questions.find(
      (item) => item._id !== question._id && !answeredIds.has(item._id),
    );
    if (nextQuestion) {
      await ctx.db.patch(nextQuestion._id, { status: "asked" });
      await ctx.db.patch(interview._id, {
        currentQuestionIndex: nextQuestion.order,
      });
    } else {
      await ctx.db.patch(interview._id, {
        status: "completed",
        currentQuestionIndex: questions.length,
        completedAt: Date.now(),
      });
      await ctx.db.patch(interview.candidateId, { status: "completed" });
      await writeDemoReport(ctx, interview.candidateId, interview._id);
    }
    return {
      candidateId: session.candidateId,
      interviewId: interview._id,
      answeredQuestionId: question._id,
      nextQuestionId: nextQuestion?._id ?? null,
      isComplete: !nextQuestion,
    };
  },
});
