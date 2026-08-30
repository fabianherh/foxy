import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoCandidate, demoRole, createDemoEvidence } from "./demo";
import { analyzeCandidate } from "./engine";
import { buildCandidateIntelligence, extractCvClaims } from "./evidence";
import { evaluateAnswer } from "./evaluation";
import { generateInterviewQuestions } from "./questions";
import { buildTechnicalAssessment } from "./report";
import { parsePublicUrl } from "./public-url";
import { parseAnalyzeRequest } from "./validation";

beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("candidate intelligence", () => {
  it("extracts technical claims from CV text", () => {
    const claims = extractCvClaims(demoCandidate.cvText);
    expect(claims.length).toBeGreaterThan(4);
    expect(claims.some((claim) => claim.technologies.includes("aws"))).toBe(true);
    expect(claims.some((claim) => claim.technologies.includes("react"))).toBe(true);
  });

  it("distinguishes strong, weak, and absent public evidence", () => {
    const intelligence = buildCandidateIntelligence(demoCandidate, demoRole, createDemoEvidence());
    expect(intelligence.competencies.find((item) => item.competency.id === "react")?.strength).toBe("strong");
    expect(intelligence.competencies.find((item) => item.competency.id === "docker")?.strength).toBe("weak");
    expect(intelligence.competencies.find((item) => item.competency.id === "aws")?.strength).toBe("none");
  });

  it("generates evidence-grounded questions with a harder AWS gap probe", async () => {
    const intelligence = buildCandidateIntelligence(demoCandidate, demoRole, createDemoEvidence());
    const questions = await generateInterviewQuestions(intelligence);
    expect(questions).toHaveLength(7);
    const awsQuestion = questions.find((question) => question.competencyId === "aws");
    expect(awsQuestion?.kind).toBe("gap_probe");
    expect(awsQuestion?.prompt).toContain("couldn't find public implementation evidence");
    const codeQuestions = questions.filter((question) => question.format === "code_multiple_choice");
    expect(codeQuestions.length).toBeGreaterThanOrEqual(1);
    expect(codeQuestions.length).toBeLessThanOrEqual(2);
    expect(codeQuestions.every((question) => question.codeSnippet && question.choices?.length === 4)).toBe(true);
  });

  it("creates an adaptive follow-up for an insufficient answer", async () => {
    const intelligence = buildCandidateIntelligence(demoCandidate, demoRole, createDemoEvidence());
    const question = (await generateInterviewQuestions(intelligence)).find((item) => item.competencyId === "aws")!;
    const evaluation = await evaluateAnswer({ intelligence, question, answer: "I used AWS before.", previousEvaluations: [] });
    expect(evaluation.status).toBe("needs_human_review");
    expect(evaluation.followUp?.kind).toBe("adaptive_follow_up");
    expect(evaluation.evidenceRefs).toEqual(question.evidenceRefs);
    expect(evaluation.questionScore).toBeCloseTo((evaluation.subscores.technicalAccuracy + evaluation.subscores.depthOfUnderstanding + evaluation.subscores.requirementAlignment) / 3, 1);
    expect(evaluation.score).toBe(Math.round(evaluation.questionScore * 10));
    expect(evaluation.authenticity.status).toBe("insufficient_evidence");
  });

  it("never advances when required competencies have no interview answers", async () => {
    const intelligence = buildCandidateIntelligence(demoCandidate, demoRole, createDemoEvidence());
    const report = await buildTechnicalAssessment(intelligence, []);
    expect(report.recommendation).toBe("human_review");
    expect(report.competencies.every((item) => item.status === "needs_human_review")).toBe(true);
    expect(report.mustHaves).toHaveLength(5);
    expect(report.authenticityFlags).toEqual([]);
  });

  it("keeps the synthetic demo deterministic without an external request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await analyzeCandidate({ candidate: demoCandidate, role: demoRole, demoFallback: true });
    expect(result.intelligence.webEvidence.provider).toBe("demo_fallback");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back when the configured language model is unavailable", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const intelligence = buildCandidateIntelligence(demoCandidate, demoRole, createDemoEvidence());
    await expect(generateInterviewQuestions(intelligence)).resolves.toHaveLength(7);
  });

  it("accepts an application without a résumé", () => {
    const request = parseAnalyzeRequest({ candidate: { id: "candidate", name: "Alex", githubUrl: "github.com/octocat" }, role: demoRole });
    expect(request.candidate.cvText).toBe("");
    expect(request.candidate.githubUrl).toBe("https://github.com/octocat");
  });

  it("rejects private and metadata URLs", () => {
    expect(() => parsePublicUrl("http://127.0.0.1/admin")).toThrow("Private");
    expect(() => parsePublicUrl("http://169.254.169.254/latest/meta-data")).toThrow("Private");
    expect(() => parsePublicUrl("http://10.0.0.1/internal")).toThrow("Private");
  });
});
