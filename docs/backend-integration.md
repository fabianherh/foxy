# Foxy Convex backend

Foxy's backend models the vetting chain as `Job -> Candidate -> Evidence -> Interview -> Questions -> Answers -> Report`. Convex queries are reactive, so a recruiter dashboard subscribed to a candidate workspace receives answer, progress, score, and report changes without polling.

## Local setup

Use Node.js 22 and npm. On Windows, newer experimental Node versions can hit an upstream libuv shutdown assertion after a successful Convex CLI command.

```bash
npm install
npm run dev
```

The repository is configured with a local Convex deployment. `npm run dev` compiles and watches `convex/`, regenerates `convex/_generated/`, and serves Convex at the URL in `.env.local`. The local environment file and deployment state are Git-ignored. To connect a shared cloud project, run `npx convex login` and then `npx convex dev --configure new` or `npx convex dev --configure existing`; do not commit the resulting credentials.

Verification commands:

```bash
npm run typecheck
npm run convex:check
npm run test:realtime
```

## Public functions

| Domain | Functions |
| --- | --- |
| Jobs | `jobs:createJob`, `jobs:getJob`, `jobs:listJobs` |
| Candidates | `candidates:createCandidate`, `candidates:getCandidate`, `candidates:listCandidatesByJob`, `candidates:updateCandidateStatus` |
| Evidence | `evidence:saveEvidence`, `evidence:saveEvidenceBatch`, `evidence:getCandidateEvidence` |
| Interviews | `interviews:createInterview`, `interviews:startInterview`, `interviews:getInterview`, `interviews:completeInterview` |
| Questions | `questions:saveQuestions`, `questions:getInterviewQuestions`, `questions:markQuestionAsked` |
| Answers | `answers:saveAnswer`, `answers:getInterviewAnswers` |
| Reports | `reports:saveReport`, `reports:getCandidateReport` |
| Workspace | `workspace:getCandidateWorkspace` |
| CV storage | `storage:generateCvUploadUrl`, `storage:attachCandidateCv`, `storage:getCandidateCvUrl` |
| Demo | `demo:seedDemo`, `demo:createFreshDemoSession`, `demo:demoAnswerNextQuestion`, `demo:resetDemo` |

All writes use Convex mutations and validators. IDs in payloads are Convex IDs, not arbitrary strings. Scores are `0-100`; answer confidence is `0-1`.

## Realtime workspace

A frontend should keep one subscription open for the recruiter view:

```ts
const workspace = useQuery(api.workspace.getCandidateWorkspace, { candidateId });
```

The result is:

```ts
{
  candidate,
  job,
  evidence,
  interview,
  questions,
  answers,
  report,
}
```

Convex tracks every document read by this query. Saving an answer, updating evidence, advancing the interview, or writing the report invalidates the subscription and pushes the new workspace to all connected browsers.

## Context.dev evidence contract

Call `api.evidence.saveEvidenceBatch` as a mutation:

```ts
await convex.mutation(api.evidence.saveEvidenceBatch, {
  candidateId,
  evidence: [
    {
      skill: "React",
      claim: "Built production React applications",
      source: "github",
      evidenceUrl: "https://github.com/example/repository",
      evidenceText: "Implemented and tested a production component system.",
      strength: "strong",
      verificationStatus: "supported",
    },
  ],
});
```

The batch mutation is retry-safe for the same candidate, skill, claim, and source: matching evidence is updated instead of duplicated.

## AI interview contracts

Questions are ordered by their array position:

```ts
await convex.mutation(api.questions.saveQuestions, {
  interviewId,
  questions: [
    {
      competency: "React",
      question: "Why did you choose this state boundary?",
      reason: "Verify architecture evidence from the candidate repository.",
      evidenceId,
    },
  ],
});
await convex.mutation(api.interviews.startInterview, { interviewId });
```

Question sets can be created or safely replaced while the interview is pending. Starting the interview marks the first question as asked.

Save or retry an answer by question ID:

```ts
await convex.mutation(api.answers.saveAnswer, {
  interviewId,
  questionId,
  transcript: "Candidate transcript...",
  score: 84,
  evaluation: "Demonstrated a clear trade-off analysis.",
  confidence: 0.91,
});
```

`saveAnswer` derives the candidate from the interview, upserts one answer per question, marks the question answered, advances `currentQuestionIndex`, and marks the next question asked. Only the asked question can receive a new answer; retrying that answer remains safe while the interview is active.

After every question is answered, complete the interview and write the final report:

```ts
await convex.mutation(api.interviews.completeInterview, { interviewId });
```

```ts
await convex.mutation(api.reports.saveReport, {
  candidateId,
  interviewId,
  recommendation: "advance",
  overallScore: 86,
  technicalScore: 85,
  evidenceScore: 87,
  strengths: ["Strong TypeScript evidence"],
  concerns: ["Cloud operations need follow-up"],
  summary: "Advance to a focused human interview.",
});
```

Third-party network calls should be added as Convex Actions. Queries and mutations must remain deterministic database operations.

## Demo workflow

Create a completed synthetic candidate, including five evidence records, five questions and answers, and a report:

```bash
npm run demo:seed
```

Start a clean active interview for the two-browser realtime demo:

```bash
npm run demo:fresh
npm run demo:next
```

Keep the recruiter dashboard subscribed to the returned `candidateId`, then run `npm run demo:next` repeatedly. The fifth invocation completes the candidate and interview and creates the sample report. Each seed/fresh call atomically removes only the tracked demo graph before recreating it, so rehearsals do not accumulate duplicates. `npm run demo:reset` removes the tracked demo data.

Demo mutations are intentionally public for the unauthenticated hackathon build. Gate or remove them before exposing a production deployment.

## CV upload flow

1. Call `storage:generateCvUploadUrl`.
2. `POST` the PDF bytes to the returned URL with the correct content type; Convex returns a `storageId`.
3. Call `storage:attachCandidateCv` with `candidateId` and `storageId`.
4. Query `storage:getCandidateCvUrl` when an authorized download URL is needed.

The backend stores the PDF but does not parse it.
