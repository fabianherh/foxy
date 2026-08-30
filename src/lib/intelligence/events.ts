import type { AnswerEvaluation, CandidateIntelligence, IntelligenceEvent, InterviewQuestion, TechnicalAssessment, WebEvidenceBundle } from "./types";

export const intelligenceEvents = {
  evidence(candidateId: string, payload: WebEvidenceBundle): IntelligenceEvent {
    return { type: "evidence.extracted", candidateId, payload };
  },
  questions(candidateId: string, payload: InterviewQuestion[]): IntelligenceEvent {
    return { type: "questions.generated", candidateId, payload };
  },
  transcript(candidateId: string, sessionId: string, questionId: string, transcript: string): IntelligenceEvent {
    return { type: "answer.transcribed", candidateId, sessionId, payload: { questionId, transcript, at: Date.now() } };
  },
  evaluation(candidateId: string, sessionId: string, payload: AnswerEvaluation): IntelligenceEvent {
    return { type: "answer.evaluated", candidateId, sessionId, payload };
  },
  assessment(candidateId: string, sessionId: string, payload: TechnicalAssessment): IntelligenceEvent {
    return { type: "assessment.completed", candidateId, sessionId, payload };
  },
};

export function analysisEvents(intelligence: CandidateIntelligence, questions: InterviewQuestion[]): IntelligenceEvent[] {
  return [intelligenceEvents.evidence(intelligence.candidate.id, intelligence.webEvidence), intelligenceEvents.questions(intelligence.candidate.id, questions)];
}
