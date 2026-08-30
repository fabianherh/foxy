import assert from "node:assert/strict";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("CONVEX_URL is missing; run npx convex dev first");
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), 10_000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const client = new ConvexClient(convexUrl);
let unsubscribe = () => {};

try {
  const session = await client.mutation(api.demo.createFreshDemoSession, {});
  let resolveInitial;
  let rejectInitial;
  let resolveRealtime;
  let rejectRealtime;
  const initialUpdate = new Promise((resolve, reject) => {
    resolveInitial = resolve;
    rejectInitial = reject;
  });
  const answerUpdate = new Promise((resolve, reject) => {
    resolveRealtime = resolve;
    rejectRealtime = reject;
  });
  unsubscribe = client.onUpdate(
    api.workspace.getCandidateWorkspace,
    { candidateId: session.candidateId },
    (workspace) => {
      if (workspace?.answers.length === 0) {
        resolveInitial(workspace);
      }
      if (workspace && workspace.answers.length >= 1) {
        resolveRealtime(workspace);
      }
    },
    (error) => {
      rejectInitial(error);
      rejectRealtime(error);
    },
  );
  const initial = await withTimeout(initialUpdate, "Initial subscription");
  assert.equal(initial.interview.status, "active");
  assert.equal(initial.questions.length, 5);
  assert.equal(initial.answers.length, 0);

  const uploadUrl = await client.mutation(api.storage.generateCvUploadUrl, {});
  const pdfBody = new TextEncoder().encode("%PDF-1.4\n%%EOF");
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdfBody,
  });
  assert.ok(uploadResponse.ok);
  const { storageId } = await uploadResponse.json();
  await client.mutation(api.storage.attachCandidateCv, {
    candidateId: session.candidateId,
    storageId,
  });
  const cvUrl = await client.query(api.storage.getCandidateCvUrl, {
    candidateId: session.candidateId,
  });
  assert.ok(cvUrl);
  const cvResponse = await fetch(cvUrl);
  assert.ok(cvResponse.ok);
  assert.equal(await cvResponse.text(), "%PDF-1.4\n%%EOF");

  const firstEvidence = initial.evidence[0];
  const evidenceResult = await client.mutation(api.evidence.saveEvidenceBatch, {
    candidateId: session.candidateId,
    evidence: [
      {
        skill: firstEvidence.skill,
        claim: firstEvidence.claim,
        source: firstEvidence.source,
        evidenceUrl: firstEvidence.evidenceUrl,
        evidenceText: firstEvidence.evidenceText,
        strength: firstEvidence.strength,
        verificationStatus: firstEvidence.verificationStatus,
      },
    ],
  });
  assert.equal(evidenceResult.count, 1);
  const evidenceAfterUpsert = await client.query(
    api.evidence.getCandidateEvidence,
    { candidateId: session.candidateId },
  );
  assert.equal(evidenceAfterUpsert.length, 5);

  await client.mutation(api.answers.saveAnswer, {
    interviewId: session.interviewId,
    questionId: initial.questions[0]._id,
    transcript: "I measured mobile LCP before and after splitting the catalog route and checked the bundle composition to isolate the improvement.",
    score: 91,
    evaluation: "Links the code decision to a user metric and a defensible measurement method.",
    confidence: 0.94,
  });
  const realtime = await withTimeout(answerUpdate, "Realtime answer update");
  assert.equal(realtime.answers.length, 1);
  assert.equal(realtime.interview.currentQuestionIndex, 1);
  unsubscribe();
  unsubscribe = () => {};

  for (let index = 1; index < 5; index += 1) {
    await client.mutation(api.demo.demoAnswerNextQuestion, {});
  }
  const completed = await client.query(api.workspace.getCandidateWorkspace, {
    candidateId: session.candidateId,
  });
  assert.equal(completed.candidate.status, "completed");
  assert.equal(completed.interview.status, "completed");
  assert.equal(completed.answers.length, 5);
  assert.equal(completed.report.recommendation, "advance");

  await client.mutation(api.reports.saveReport, {
    candidateId: session.candidateId,
    interviewId: session.interviewId,
    recommendation: completed.report.recommendation,
    overallScore: completed.report.overallScore,
    technicalScore: completed.report.technicalScore,
    evidenceScore: completed.report.evidenceScore,
    strengths: completed.report.strengths,
    concerns: completed.report.concerns,
    summary: `${completed.report.summary} Contract update verified.`,
  });
  const updatedReport = await client.query(api.reports.getCandidateReport, {
    candidateId: session.candidateId,
  });
  assert.match(updatedReport.summary, /Contract update verified/);

  const contractInterviewId = await client.mutation(
    api.interviews.createInterview,
    { candidateId: session.candidateId, jobId: session.jobId },
  );
  await client.mutation(api.candidates.updateCandidateStatus, {
    candidateId: session.candidateId,
    status: "ready",
  });
  const contractQuestionIds = await client.mutation(
    api.questions.saveQuestions,
    {
      interviewId: contractInterviewId,
      questions: [
        {
          competency: "TypeScript",
          question: "Where must runtime validation complement static types?",
          reason: "Verify the public API contract independently of demo inserts.",
          evidenceId: firstEvidence._id,
        },
      ],
    },
  );
  await client.mutation(api.interviews.startInterview, {
    interviewId: contractInterviewId,
  });
  await client.mutation(api.questions.markQuestionAsked, {
    questionId: contractQuestionIds[0],
  });
  await client.mutation(api.answers.saveAnswer, {
    interviewId: contractInterviewId,
    questionId: contractQuestionIds[0],
    transcript: "Static types end at untrusted network and storage boundaries, so those values need runtime parsing before becoming domain values.",
    score: 92,
    evaluation: "Correctly identifies trust boundaries.",
    confidence: 0.97,
  });
  const [contractInterview, contractQuestions, contractAnswers] =
    await Promise.all([
      client.query(api.interviews.getInterview, {
        interviewId: contractInterviewId,
      }),
      client.query(api.questions.getInterviewQuestions, {
        interviewId: contractInterviewId,
      }),
      client.query(api.answers.getInterviewAnswers, {
        interviewId: contractInterviewId,
      }),
    ]);
  assert.equal(contractInterview.status, "active");
  assert.equal(contractQuestions[0].status, "answered");
  assert.equal(contractAnswers.length, 1);
  await client.mutation(api.interviews.completeInterview, {
    interviewId: contractInterviewId,
  });

  const [job, jobs, candidate, candidates] = await Promise.all([
    client.query(api.jobs.getJob, { jobId: session.jobId }),
    client.query(api.jobs.listJobs, { status: "open" }),
    client.query(api.candidates.getCandidate, {
      candidateId: session.candidateId,
    }),
    client.query(api.candidates.listCandidatesByJob, {
      jobId: session.jobId,
    }),
  ]);
  assert.equal(job.title, "Full Stack Software Engineer");
  assert.ok(jobs.some((item) => item._id === session.jobId));
  assert.equal(candidate.name, "Maya Chen");
  assert.ok(candidates.some((item) => item._id === session.candidateId));

  const seeded = await client.mutation(api.demo.seedDemo, {});
  const seededWorkspace = await client.query(api.workspace.getCandidateWorkspace, {
    candidateId: seeded.candidateId,
  });
  assert.equal(seededWorkspace.evidence.length, 5);
  assert.equal(seededWorkspace.answers.length, 5);
  assert.ok(seededWorkspace.report);

  const freshAgain = await client.mutation(api.demo.createFreshDemoSession, {});
  const removedWorkspace = await client.query(api.workspace.getCandidateWorkspace, {
    candidateId: seeded.candidateId,
  });
  const cleanWorkspace = await client.query(api.workspace.getCandidateWorkspace, {
    candidateId: freshAgain.candidateId,
  });
  assert.equal(removedWorkspace, null);
  assert.equal(cleanWorkspace.answers.length, 0);
  assert.equal(cleanWorkspace.report, null);

  console.log(
    JSON.stringify({
      realtimeUpdateObserved: true,
      domainContractsVerified: true,
      cvStorageVerified: true,
      completedAnswers: completed.answers.length,
      cleanReplayVerified: true,
      candidateId: freshAgain.candidateId,
    }),
  );
} finally {
  unsubscribe();
  await client.close();
}
