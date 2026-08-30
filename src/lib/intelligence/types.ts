export type EvidenceStrength = "strong" | "moderate" | "weak" | "none";
export type VerificationStatus = "verified" | "partially_verified" | "unverified" | "needs_human_review";
export type Recommendation = "advance" | "human_review" | "do_not_advance";
export type QuestionKind = "baseline" | "evidence_probe" | "gap_probe" | "adaptive_follow_up";

export interface RoleCompetency {
  id: string;
  name: string;
  description: string;
  required: boolean;
  weight: number;
  keywords: string[];
}

export interface RoleDefinition {
  id: string;
  title: string;
  competencies: RoleCompetency[];
}

export interface CandidateInput {
  id: string;
  name: string;
  cvText: string;
  githubUrl?: string;
  portfolioUrls?: string[];
}

export interface CandidateClaim {
  id: string;
  statement: string;
  technologies: string[];
  source: "cv" | "github" | "portfolio";
}

export interface EvidenceSource {
  url: string;
  title: string;
  excerpt: string;
  sourceType: "github_profile" | "repository" | "portfolio" | "cv";
}

export interface ProjectEvidence {
  id: string;
  name: string;
  description: string;
  url: string;
  technologies: string[];
  signals: string[];
  strength: EvidenceStrength;
  source: EvidenceSource;
}

export interface WebEvidenceBundle {
  provider: "context.dev" | "demo_fallback";
  analyzedUrls: string[];
  projects: ProjectEvidence[];
  technologies: string[];
  webClaims: CandidateClaim[];
  extractedAt: number;
}

export interface ClaimEvidenceLink {
  claim: CandidateClaim;
  evidence: ProjectEvidence[];
  strength: EvidenceStrength;
  rationale: string;
}

export interface CompetencyEvidence {
  competency: RoleCompetency;
  status: VerificationStatus;
  strength: EvidenceStrength;
  claims: CandidateClaim[];
  evidence: ProjectEvidence[];
  rationale: string;
}

export interface CandidateIntelligence {
  candidate: CandidateInput;
  role: RoleDefinition;
  claims: CandidateClaim[];
  webEvidence: WebEvidenceBundle;
  claimEvidence: ClaimEvidenceLink[];
  competencies: CompetencyEvidence[];
}

export interface QuestionChoice {
  id: string;
  label: string;
}

export interface InterviewQuestion {
  id: string;
  competencyId: string;
  kind: QuestionKind;
  format?: "open" | "code_multiple_choice";
  prompt: string;
  codeSnippet?: string;
  codeLanguage?: string;
  choices?: QuestionChoice[];
  rationale: string;
  evidenceRefs: string[];
  expectedSignals: string[];
  sequence: number;
  parentQuestionId?: string;
}

export interface QuestionSubscores {
  technicalAccuracy: number;
  depthOfUnderstanding: number;
  requirementAlignment: number;
}

export interface AuthenticityAssessment {
  status: "consistent" | "insufficient_evidence" | "inconsistent_with_repository_evidence";
  rationale: string;
}

export interface AnswerEvaluation {
  questionId: string;
  competencyId: string;
  answer: string;
  score: number;
  questionScore: number;
  subscores: QuestionSubscores;
  authenticity: AuthenticityAssessment;
  status: VerificationStatus;
  confidence: number;
  demonstratedSignals: string[];
  missingSignals: string[];
  rationale: string;
  evidenceRefs: string[];
  followUp?: InterviewQuestion;
}

export interface CompetencyVerdict {
  competencyId: string;
  competencyName: string;
  status: VerificationStatus;
  score: number;
  subscores: QuestionSubscores;
  mustHave: boolean;
  demonstrated: boolean;
  confidence: number;
  rationale: string;
  evidenceRefs: string[];
  answerRefs: string[];
}

export interface MustHaveResult {
  competencyId: string;
  competencyName: string;
  demonstrated: boolean;
}

export interface AuthenticityFlag {
  questionId: string;
  competencyId: string;
  rationale: string;
  evidenceRefs: string[];
}

export interface TechnicalAssessment {
  candidateId: string;
  roleId: string;
  recommendation: Recommendation;
  overallScore: number;
  summary: string;
  strengths: string[];
  risks: string[];
  competencies: CompetencyVerdict[];
  mustHaves: MustHaveResult[];
  authenticityFlags: AuthenticityFlag[];
  generatedAt: number;
}

export interface AnalyzeCandidateRequest {
  candidate: CandidateInput;
  role: RoleDefinition;
  demoFallback?: boolean;
}

export interface AnalyzeCandidateResult {
  intelligence: CandidateIntelligence;
  questions: InterviewQuestion[];
}

export interface EvaluateAnswerRequest {
  intelligence: CandidateIntelligence;
  question: InterviewQuestion;
  answer: string;
  previousEvaluations?: AnswerEvaluation[];
}

export type IntelligenceEvent =
  | { type: "evidence.extracted"; candidateId: string; payload: WebEvidenceBundle }
  | { type: "questions.generated"; candidateId: string; payload: InterviewQuestion[] }
  | { type: "answer.transcribed"; candidateId: string; sessionId: string; payload: { questionId: string; transcript: string; at: number } }
  | { type: "answer.evaluated"; candidateId: string; sessionId: string; payload: AnswerEvaluation }
  | { type: "assessment.completed"; candidateId: string; sessionId: string; payload: TechnicalAssessment };
