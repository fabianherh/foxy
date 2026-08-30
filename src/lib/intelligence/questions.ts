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
          format: { type: "string", enum: ["open", "code_multiple_choice"] },
          prompt: { type: "string" },
          codeSnippet: { type: ["string", "null"] },
          codeLanguage: { type: ["string", "null"] },
          choices: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } }, required: ["id", "label"], additionalProperties: false } },
          rationale: { type: "string" },
          evidenceRefs: { type: "array", items: { type: "string" } },
          expectedSignals: { type: "array", items: { type: "string" } },
        },
        required: ["competencyId", "kind", "format", "prompt", "codeSnippet", "codeLanguage", "choices", "rationale", "evidenceRefs", "expectedSignals"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

type GeneratedQuestion = Omit<InterviewQuestion, "id" | "sequence" | "codeSnippet" | "codeLanguage"> & { codeSnippet: string | null; codeLanguage: string | null };
type GeneratedQuestions = { questions: GeneratedQuestion[] };

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
      format: "open" as const,
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
      format: "open",
      prompt: `Tell me about a time ${weakest.competency.name} failed in production or behaved unexpectedly. How did you isolate the cause, and what did you change afterward?`,
      rationale: `A second probe is warranted because evidence for ${weakest.competency.name} is ${weakest.strength}.`,
      evidenceRefs: weakest.evidence.map((item) => item.id),
      expectedSignals: ["concrete incident", "systematic diagnosis", "root cause", "preventive action"],
      sequence: questions.length,
    });
  }
  return ensureCodingQuestions(questions.slice(0, 7), intelligence);
}

function ensureCodingQuestions(questions: InterviewQuestion[], intelligence: CandidateIntelligence): InterviewQuestion[] {
  const validCodeQuestions = questions.filter((question) => question.format === "code_multiple_choice" && question.codeSnippet && question.choices?.length === 4);
  if (validCodeQuestions.length) return questions;
  const result = [...questions];
  const reactIndex = result.findIndex((question) => intelligence.role.competencies.find((item) => item.id === question.competencyId)?.name.toLowerCase().includes("react"));
  if (reactIndex >= 0) result[reactIndex] = {
    ...result[reactIndex],
    format: "code_multiple_choice",
    prompt: "Why might clicking Add fail to render the new item, and what is the best fix?",
    codeLanguage: "tsx",
    codeSnippet: `const [items, setItems] = useState<string[]>([]);\n\nfunction addItem(item: string) {\n  items.push(item);\n  setItems(items);\n}`,
    choices: [
      { id: "a", label: "React state updates are asynchronous, so wrap setItems in setTimeout." },
      { id: "b", label: "The array reference is unchanged; create a new array with setItems([...items, item])." },
      { id: "c", label: "useState cannot store arrays; replace it with useRef." },
      { id: "d", label: "items.push returns the wrong type; call setItems(items.push(item))." },
    ],
    expectedSignals: ["Correct choice: b", "React compares state references", "immutable state update"],
    rationale: "Tests practical React state and rendering understanding with executable-looking code.",
  };
  const backendIndex = result.findIndex((question, index) => index !== reactIndex && /backend|api|typescript/i.test(intelligence.role.competencies.find((item) => item.id === question.competencyId)?.name ?? ""));
  if (backendIndex >= 0 && result.length >= 6) result[backendIndex] = {
    ...result[backendIndex],
    format: "code_multiple_choice",
    prompt: "What is the most important production issue in this API helper?",
    codeLanguage: "typescript",
    codeSnippet: `async function getUser(id: string) {\n  try {\n    return await db.user.findUnique({ where: { id } });\n  } catch (error) {\n    console.log(error);\n  }\n}`,
    choices: [
      { id: "a", label: "findUnique should never be awaited." },
      { id: "b", label: "The id parameter must be a number." },
      { id: "c", label: "Database failures are swallowed and callers receive undefined without a typed error path." },
      { id: "d", label: "try/catch cannot be used inside async functions." },
    ],
    expectedSignals: ["Correct choice: c", "errors are swallowed", "typed error handling", "observability"],
    rationale: "Tests backend error-boundary and API contract judgment.",
  };
  return result;
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
    "You are a rigorous, fair senior full-stack software interviewer. Generate 5-7 concise questions grounded only in the supplied role, claims, and evidence. Include 1-2 code_multiple_choice questions with a realistic short code snippet and exactly four plausible choices when the role has coding competencies; use open format for all others. Cover every required competency. Probe weak or absent evidence harder without treating absence as dishonesty. Ask for concrete personal contributions, decisions, trade-offs, failure modes, and validation. Never infer protected characteristics or assess communication style, accent, personality, or culture fit. Evidence refs must be IDs present in the input. Keep each prompt under 55 words.",
    compactIntelligence(intelligence),
  );
  const allowedCompetencies = new Set(intelligence.role.competencies.map((item) => item.id));
  const allowedEvidence = new Set(intelligence.webEvidence.projects.map((item) => item.id));
  if (!generated?.questions?.length) return fallbackQuestions(intelligence);
  const questions: InterviewQuestion[] = generated.questions.filter((item) => allowedCompetencies.has(item.competencyId) && item.prompt?.trim()).slice(0, 7).map((item, index) => ({
    ...item,
    id: `question-${index}`,
    format: item.format === "code_multiple_choice" ? "code_multiple_choice" : "open",
    prompt: item.prompt.trim().slice(0, 600),
    codeSnippet: item.codeSnippet?.slice(0, 2000),
    codeLanguage: item.codeLanguage?.slice(0, 30),
    choices: item.choices?.map((choice) => ({ id: choice.id.slice(0, 20), label: choice.label.slice(0, 500) })).slice(0, 4),
    rationale: item.rationale.trim().slice(0, 600),
    evidenceRefs: item.evidenceRefs.filter((id) => allowedEvidence.has(id)),
    expectedSignals: item.expectedSignals.map((signal) => signal.trim()).filter(Boolean).slice(0, 8),
    sequence: index,
  }));
  return questions.length >= 5 ? ensureCodingQuestions(questions, intelligence) : fallbackQuestions(intelligence);
}
