import { generateStructured } from "./llm";
import type { CandidateIntelligence, InterviewQuestion, QuestionKind } from "./types";

const questionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          competencyId: { type: "string" },
          kind: { type: "string", enum: ["baseline", "evidence_probe", "gap_probe"] },
          prompt: { type: "string" },
          rationale: { type: "string" },
          evidenceRefs: { type: "array", items: { type: "string" } },
          expectedSignals: { type: "array", items: { type: "string" } },
        },
        required: ["competencyId", "kind", "prompt", "rationale", "evidenceRefs", "expectedSignals"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

type GeneratedQuestions = { questions: Array<Omit<InterviewQuestion, "id" | "sequence">> };

function fallbackQuestions(intelligence: CandidateIntelligence): InterviewQuestion[] {
  const questions = intelligence.competencies.map((item, index) => {
    const project = item.evidence[0];
    const claim = item.claims[0];
    const kind: QuestionKind = project ? "evidence_probe" : claim ? "gap_probe" : "baseline";
    const prompt = project
      ? `In ${project.name}, we found evidence of ${item.competency.name}. Walk me through one important technical decision you made, the alternatives you considered, and how you validated the result.`
      : claim
        ? `Your CV says: “${claim.statement}” I couldn't find public implementation evidence for ${item.competency.name}. Describe a concrete implementation, your personal contribution, and one trade-off you made.`
        : `Let's assess ${item.competency.name}. Describe how you would implement it in a production full-stack application, including one failure mode and how you would test it.`;
    return {
      id: `question-${index}`,
      competencyId: item.competency.id,
      kind,
      prompt,
      rationale: item.rationale,
      evidenceRefs: project ? [project.id] : [],
      expectedSignals: ["specific personal contribution", "technical trade-off", "validation or testing", ...item.competency.keywords.slice(0, 3)],
      sequence: index,
    };
  });
  const strengthRank = { none: 0, weak: 1, moderate: 2, strong: 3 };
  const weakest = [...intelligence.competencies].sort((a, b) => strengthRank[a.strength] - strengthRank[b.strength])[0];
  if (questions.length < 5 && weakest) {
    questions.push({
      id: `question-${questions.length}`,
      competencyId: weakest.competency.id,
      kind: "gap_probe",
      prompt: `Tell me about a time ${weakest.competency.name} failed in production or behaved unexpectedly. How did you isolate the cause, and what did you change afterward?`,
      rationale: `A second probe is warranted because evidence for ${weakest.competency.name} is ${weakest.strength}.`,
      evidenceRefs: weakest.evidence.map((item) => item.id),
      expectedSignals: ["concrete incident", "systematic diagnosis", "root cause", "preventive action"],
      sequence: questions.length,
    });
  }
  return questions.slice(0, 7);
}

function compactIntelligence(intelligence: CandidateIntelligence) {
  return {
    role: intelligence.role,
    candidateName: intelligence.candidate.name,
    competencies: intelligence.competencies.map((item) => ({
      id: item.competency.id,
      name: item.competency.name,
      required: item.competency.required,
      strength: item.strength,
      rationale: item.rationale,
      claims: item.claims.map((claim) => ({ id: claim.id, statement: claim.statement })),
      evidence: item.evidence.map((evidence) => ({ id: evidence.id, name: evidence.name, description: evidence.description, technologies: evidence.technologies, signals: evidence.signals, excerpt: evidence.source.excerpt })),
    })),
  };
}

export async function generateInterviewQuestions(intelligence: CandidateIntelligence): Promise<InterviewQuestion[]> {
  const generated = await generateStructured<GeneratedQuestions>(
    "foxy_interview_questions",
    questionSchema,
    "You are a rigorous, fair senior full-stack software interviewer. Generate 5-7 concise spoken questions grounded only in the supplied role, claims, and evidence. Cover every required competency. Probe weak or absent evidence harder without treating absence as dishonesty. Ask for concrete personal contributions, decisions, trade-offs, failure modes, and validation. Never infer protected characteristics or assess communication style, accent, personality, or culture fit. Evidence refs must be IDs present in the input. Keep each prompt under 55 words.",
    compactIntelligence(intelligence),
  );
  const allowedCompetencies = new Set(intelligence.role.competencies.map((item) => item.id));
  const allowedEvidence = new Set(intelligence.webEvidence.projects.map((item) => item.id));
  if (!generated?.questions?.length) return fallbackQuestions(intelligence);
  const questions = generated.questions.filter((item) => allowedCompetencies.has(item.competencyId) && item.prompt?.trim()).slice(0, 7).map((item, index) => ({
    ...item,
    id: `question-${index}`,
    prompt: item.prompt.trim().slice(0, 600),
    rationale: item.rationale.trim().slice(0, 600),
    evidenceRefs: item.evidenceRefs.filter((id) => allowedEvidence.has(id)),
    expectedSignals: item.expectedSignals.map((signal) => signal.trim()).filter(Boolean).slice(0, 8),
    sequence: index,
  }));
  return questions.length >= 5 ? questions : fallbackQuestions(intelligence);
}
