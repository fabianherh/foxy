"use client";

import { useEffect, useRef, useState } from "react";
import { demoRole } from "@/lib/intelligence/demo";
import type { AnalyzeCandidateResult, AnswerEvaluation, CandidateInput, InterviewQuestion, TechnicalAssessment } from "@/lib/intelligence/types";
import { speakInterviewPrompt, transcribeWithBrowser, type VoiceMode } from "@/lib/voice/browser";

type Stage = "candidate" | "evidence" | "interview" | "report";
type AnalysisResponse = AnalyzeCandidateResult & { events: unknown[] };

const stages: Array<{ id: Stage; label: string }> = [
  { id: "candidate", label: "Application" },
  { id: "evidence", label: "Setup" },
  { id: "interview", label: "Interview" },
  { id: "report", label: "Complete" },
];

const loadingMessages = ["Reading CV claims", "Reviewing public GitHub work", "Mapping evidence to competencies", "Generating interview challenges"];

function Icon({ name, size = 18 }: { name: "arrow" | "check" | "github" | "mic" | "play" | "stop" | "refresh" | "link"; size?: number }) {
  const paths = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    github: <><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.4 4 5 5 0 0 0 19.3.5S18.2.1 15 1.8a13.4 13.4 0 0 0-7 0C4.8.1 3.7.5 3.7.5A5 5 0 0 0 3.6 4a5.4 5.4 0 0 0-1.4 3.7c0 5.4 3.5 6.6 6.8 7A4.8 4.8 0 0 0 8 18v4"/><path d="M8 19c-3 .9-3-1.5-4-2"/></>,
    mic: <><rect width="8" height="13" x="8" y="2" rx="4"/><path d="M18 10v2a6 6 0 0 1-12 0v-2"/><path d="M12 18v4"/></>,
    play: <><polygon points="6 3 20 12 6 21 6 3"/></>,
    stop: <rect width="14" height="14" x="5" y="5" rx="2"/>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function AppHeader({ stage, onReset }: { stage: Stage; onReset: () => void }) {
  const current = stages.findIndex((item) => item.id === stage);
  return (
    <header className="app-header">
      <button className="brand" onClick={onReset} aria-label="Reset Foxy">
        <span className="brand-mark">F</span>
        <span>Foxy</span>
        <span className="brand-mode">Lab</span>
      </button>
      <nav className="stage-nav" aria-label="Interview progress">
        {stages.map((item, index) => <div key={item.id} className={`stage-item ${index === current ? "active" : ""} ${index < current ? "complete" : ""}`}><span>{index < current ? <Icon name="check" size={13} /> : index + 1}</span>{item.label}</div>)}
      </nav>
      <div className="system-live"><span />Systems ready</div>
    </header>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("candidate");
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [cvText, setCvText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [parsingResume, setParsingResume] = useState(false);
  const [draggingResume, setDraggingResume] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluations, setEvaluations] = useState<AnswerEvaluation[]>([]);
  const [currentEvaluation, setCurrentEvaluation] = useState<AnswerEvaluation | null>(null);
  const [report, setReport] = useState<TechnicalAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode | null>(null);
  const stopRecording = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!loading || stage !== "candidate") return;
    const timer = window.setInterval(() => setLoadingStep((step) => Math.min(step + 1, loadingMessages.length - 1)), 3600);
    return () => window.clearInterval(timer);
  }, [loading, stage]);

  const currentQuestion = questions[questionIndex];
  const currentCompetency = analysis?.intelligence.competencies.find((item) => item.competency.id === currentQuestion?.competencyId);

  function reset() {
    setStage("candidate"); setAnalysis(null); setQuestions([]); setEvaluations([]); setReport(null); setQuestionIndex(0); setAnswer(""); setCurrentEvaluation(null); setError("");
  }

  async function parseResume(file: File) {
    if (file.size > 10 * 1024 * 1024) { setError("Your résumé must be smaller than 10 MB."); return; }
    setParsingResume(true); setError(""); setCvText(""); setResumeFileName(file.name);
    try {
      const response = await fetch("/api/cv/parse", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": file.name }, body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The résumé could not be read.");
      setCvText(data.text);
    } catch (cause) {
      setResumeFileName(""); setError(cause instanceof Error ? cause.message : "The résumé could not be read. Try another file.");
    } finally { setParsingResume(false); }
  }

  function receiveResume(files: FileList | File[]) {
    const file = files[0];
    if (file) void parseResume(file);
  }

  async function analyzeCandidate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setLoadingStep(0); setError("");
    const candidate: CandidateInput = { id: `candidate-${Date.now()}`, name: name.trim(), cvText: cvText.trim(), githubUrl: githubUrl.trim() };
    try {
      const response = await fetch("/api/intelligence/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidate, role: demoRole }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data); setQuestions(data.questions); setStage("evidence");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not analyze this candidate. Check the inputs and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function speakQuestion() {
    if (!currentQuestion || speaking) return;
    setSpeaking(true); setError("");
    try { setVoiceMode(await speakInterviewPrompt(currentQuestion.prompt)); }
    catch { setVoiceMode("text_only"); setError("Voice playback failed. The question remains available as text."); }
    finally { setSpeaking(false); }
  }

  function toggleRecording() {
    if (recording) { stopRecording.current?.(); setRecording(false); return; }
    const session = transcribeWithBrowser((text) => setAnswer(text));
    if (!session.supported) { setError("Speech recognition is unavailable in this browser. Type the answer instead."); session.transcript.catch(() => {}); return; }
    stopRecording.current = session.stop; setRecording(true); setError("");
    session.transcript.then((text) => { if (text) setAnswer(text); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Transcription failed. Type the answer instead.")).finally(() => setRecording(false));
  }

  async function evaluateCurrentAnswer() {
    if (!analysis || !currentQuestion || answer.trim().length < 8) { setError("Add a more complete answer before asking Foxy to evaluate it."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/interview/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intelligence: analysis.intelligence, question: currentQuestion, answer, previousEvaluations: evaluations }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Evaluation failed");
      setEvaluations((items) => [...items, data]); setCurrentEvaluation(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not evaluate this answer."); }
    finally { setLoading(false); }
  }

  async function continueInterview() {
    if (!currentEvaluation) return;
    let nextQuestions = questions;
    if (currentEvaluation.followUp && !questions.some((item) => item.id === currentEvaluation.followUp?.id)) {
      nextQuestions = [...questions.slice(0, questionIndex + 1), currentEvaluation.followUp, ...questions.slice(questionIndex + 1)];
      setQuestions(nextQuestions);
    }
    if (questionIndex + 1 < nextQuestions.length) {
      setQuestionIndex((index) => index + 1); setAnswer(""); setCurrentEvaluation(null); setVoiceMode(null); return;
    }
    await generateReport();
  }

  async function generateReport() {
    if (!analysis) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/interview/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intelligence: analysis.intelligence, evaluations }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Report generation failed");
      setReport(data); setStage("report");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate the report."); }
    finally { setLoading(false); }
  }

  return (
    <div className="app-shell">
      <AppHeader stage={stage} onReset={reset} />
      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}

      {stage === "candidate" && !loading && (
        <main className="workspace candidate-workspace">
          <section className="form-pane">
            <div className="role-context"><span>Application for</span><strong>Full-Stack Software Engineer</strong></div>
            <div className="page-heading">
              <h1>Show us how you think</h1>
              <p>Share your public GitHub profile and, optionally, your résumé. Foxy will prepare a short technical interview around your actual work.</p>
            </div>
            <form onSubmit={analyzeCandidate} className="candidate-form">
              <div className="field-row">
                <label><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" autoComplete="name" required /></label>
                <label><span>GitHub profile</span><div className="input-with-icon"><Icon name="github" /><input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/username" required /></div></label>
              </div>
              <div className="resume-field">
                <span>Résumé <small>Optional</small></span>
                <label className={`resume-dropzone ${draggingResume ? "dragging" : ""} ${cvText ? "ready" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDraggingResume(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDraggingResume(false); }} onDrop={(event) => { event.preventDefault(); setDraggingResume(false); receiveResume(event.dataTransfer.files); }}>
                  <input type="file" accept=".pdf,.docx,.doc,.rtf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => event.target.files && receiveResume(event.target.files)} />
                  {parsingResume ? <><span className="upload-icon"><span className="button-spinner" /></span><strong>Reading your résumé…</strong><p>Context.dev is extracting the text securely.</p></> : cvText ? <><span className="upload-icon upload-success"><Icon name="check" /></span><strong>{resumeFileName}</strong><p>Résumé ready · {cvText.length.toLocaleString()} characters extracted</p><small>Choose another file</small></> : <><span className="upload-icon"><Icon name="arrow" /></span><strong>Drop your résumé here</strong><p>or click to choose a file</p><small>PDF, DOCX, DOC, RTF, or TXT · max 10 MB</small></>}
                </label>
              </div>
              <div className="form-action"><div><strong>Next: personalized interview</strong><span>Résumé optional · allow around 10 minutes</span></div><button className="primary-button" type="submit" disabled={parsingResume || !name.trim() || !githubUrl.trim()}>Prepare my interview <Icon name="arrow" /></button></div>
            </form>
          </section>
          <aside className="method-pane role-pane">
            <span className="role-type">Engineering · Full-time</span>
            <h2>Full-Stack Software Engineer</h2>
            <p>We’re looking for practical engineering judgment across product interfaces and backend systems.</p>
            <div className="role-competencies">{demoRole.competencies.map((item) => <div key={item.id}><Icon name="check" size={14} /><span>{item.name}</span>{item.required && <small>Core</small>}</div>)}</div>
            <div className="candidate-privacy"><strong>What happens next</strong><p>Your public work helps us ask relevant questions. Missing GitHub evidence will never be treated as proof that a résumé claim is false.</p></div>
          </aside>
        </main>
      )}

      {stage === "candidate" && loading && (
        <main className="analysis-loading">
          <div className="scan-orbit"><span>F</span><i /><i /></div>
          <h1>Preparing your interview</h1>
          <p>This usually takes 15–30 seconds while Foxy connects your résumé claims with your public work.</p>
          <div className="loading-steps">{loadingMessages.map((message, index) => <div key={message} className={index < loadingStep ? "done" : index === loadingStep ? "active" : ""}><span>{index < loadingStep ? <Icon name="check" size={14} /> : index + 1}</span>{message}</div>)}</div>
        </main>
      )}

      {stage === "evidence" && analysis && (
        <main className="setup-layout">
          <section className="setup-main">
            <span className="setup-check"><Icon name="check" size={28} /></span>
            <h1>Your interview is ready</h1>
            <p>Thanks, {analysis.intelligence.candidate.name}. Foxy prepared {questions.length} technical questions for the Full-Stack Software Engineer role.</p>
            <div className="setup-facts"><div><strong>{questions.length}</strong><span>technical questions</span></div><div><strong>1–2</strong><span>adaptive follow-ups</span></div><div><strong>~10 min</strong><span>estimated time</span></div></div>
            <button className="primary-button setup-start" onClick={() => setStage("interview")}>Start interview <Icon name="arrow" /></button>
          </section>
          <aside className="setup-aside"><h2>Before you begin</h2><div><span>01</span><p>Answer from your own experience. Concrete decisions and trade-offs are more useful than textbook definitions.</p></div><div><span>02</span><p>Use the microphone or type each response. You can always fall back to text.</p></div><div><span>03</span><p>Foxy may ask a follow-up when an important technical detail needs clarification.</p></div><div><span>04</span><p>Your answers are evaluated for technical substance, not accent, grammar, or speaking style.</p></div></aside>
        </main>
      )}

      {stage === "interview" && analysis && currentQuestion && (
        <main className="interview-layout">
          <aside className="interview-sidebar"><div><span>Interview progress</span><strong>{questionIndex + 1} <small>/ {questions.length}</small></strong><div className="progress-track"><i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div></div><div className="question-map">{questions.map((question, index) => <div key={question.id} className={index === questionIndex ? "active" : index < questionIndex ? "complete" : ""}><span>{index < questionIndex ? <Icon name="check" size={12} /> : index + 1}</span><p>{analysis.intelligence.role.competencies.find((item) => item.id === question.competencyId)?.name}</p></div>)}</div><button className="text-button" onClick={reset}><Icon name="refresh" size={15} /> Start over</button></aside>
          <section className="interview-main">
            <div className="question-meta"><span>{currentQuestion.kind.replaceAll("_", " ")}</span><span>{currentCompetency?.competency.name}</span>{voiceMode && <span>Voice: {voiceMode.replaceAll("_", " ")}</span>}</div>
            <h1>{currentQuestion.prompt}</h1>
            {currentCompetency?.evidence[0] && <div className="question-evidence"><span>Grounded in</span><strong>{currentCompetency.evidence[0].name}</strong><p>“{currentCompetency.evidence[0].source.excerpt || currentCompetency.evidence[0].description}”</p></div>}
            <div className="voice-actions"><button className="secondary-button" onClick={speakQuestion} disabled={speaking}>{speaking ? <span className="button-spinner" /> : <Icon name="play" />}{speaking ? "Speaking…" : "Play question"}</button><button className={`secondary-button ${recording ? "recording" : ""}`} onClick={toggleRecording}>{recording ? <Icon name="stop" /> : <Icon name="mic" />}{recording ? "Stop recording" : "Dictate answer"}</button></div>
            <label className="answer-field"><span>Your answer</span><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Explain your implementation, personal contribution, trade-offs, and how you verified the result." disabled={Boolean(currentEvaluation)} /></label>
            {currentEvaluation && <div className="answer-saved"><span><Icon name="check" size={15} /></span><div><strong>Answer saved</strong><p>{currentEvaluation.followUp ? "Foxy has one clarifying follow-up before moving on." : "Ready for the next question."}</p></div></div>}
            <div className="interview-action">{!currentEvaluation ? <button className="primary-button" onClick={evaluateCurrentAnswer} disabled={loading || answer.trim().length < 8}>{loading ? <span className="button-spinner" /> : null}{loading ? "Saving answer…" : "Submit answer"}</button> : <button className="primary-button" onClick={continueInterview} disabled={loading}>{questionIndex + 1 < questions.length || currentEvaluation.followUp ? "Continue interview" : "Finish interview"}<Icon name="arrow" /></button>}</div>
          </section>
        </main>
      )}

      {stage === "report" && report && (
        <main className="completion-layout">
          <span className="completion-mark"><Icon name="check" size={34} /></span>
          <h1>Interview complete</h1>
          <p>Thank you, {analysis?.intelligence.candidate.name}. Your responses have been submitted for the Full-Stack Software Engineer role.</p>
          <div className="completion-receipt"><div><span>Application</span><strong>Full-Stack Software Engineer</strong></div><div><span>Responses submitted</span><strong>{evaluations.length}</strong></div><div><span>Status</span><strong>Under review</strong></div></div>
          <small>You can close this window. The hiring team will contact you about next steps.</small>
        </main>
      )}
    </div>
  );
}
