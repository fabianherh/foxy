"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { demoRole } from "@/lib/intelligence/demo";
import type { AnalyzeCandidateResult, AnswerEvaluation, CandidateInput, InterviewQuestion, RoleCompetency, TechnicalAssessment } from "@/lib/intelligence/types";
import { startProctoring, type ProctoringSession } from "@/lib/proctoring";
import { BrandLogo, FoxyMark } from "../BrandLogo";

type Stage = "candidate" | "evidence" | "interview" | "report";
type AnalysisResponse = AnalyzeCandidateResult & { events: unknown[] };

const stages: Array<{ id: Stage; label: string }> = [
  { id: "candidate", label: "Application" },
  { id: "evidence", label: "Setup" },
  { id: "interview", label: "Interview" },
  { id: "report", label: "Complete" },
];

const loadingMessages = ["Reading CV claims", "Reviewing public GitHub work", "Mapping evidence to competencies", "Generating interview challenges"];
const subscribeToLocation = () => () => {};
const getInviteToken = () => new URLSearchParams(window.location.search).get("invite") ?? "";

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
        <BrandLogo mode="Interview" />
      </button>
      <nav className="stage-nav" aria-label="Interview progress">
        {stages.map((item, index) => <div key={item.id} className={`stage-item ${index === current ? "active" : ""} ${index < current ? "complete" : ""}`}><span>{index < current ? <Icon name="check" size={13} /> : index + 1}</span>{item.label}</div>)}
      </nav>
      <div className="system-live"><span />Systems ready</div>
    </header>
  );
}

export default function Home() {
  const urlInviteToken = useSyncExternalStore(subscribeToLocation, getInviteToken, () => "");
  const [selfServeToken, setSelfServeToken] = useState("");
  const inviteToken = urlInviteToken || selfServeToken;
  const [applicationId, setApplicationId] = useState<Id<"applications"> | null>(null);
  const inviteData = useQuery(api.applications.getByInvite, inviteToken ? { inviteToken } : "skip");
  const openJobs = useQuery(api.applications.listOpenJobs, inviteToken ? "skip" : {});
  const applyToJob = useMutation(api.applications.applyToJob);
  const submitProfile = useMutation(api.applications.submitCandidateProfile);
  const analyzeApplication = useAction(api.interview.analyzeApplication);
  const evaluateApplicationAnswer = useAction(api.interview.evaluateApplicationAnswer);
  const finalizeApplication = useAction(api.interview.finalizeApplication);
  const generateRecordingUploadUrl = useMutation(api.recordings.generateUploadUrl);
  const saveRecording = useMutation(api.recordings.saveRecording);
  const [stage, setStage] = useState<Stage>("candidate");
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubStatus, setGithubStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [githubProfile, setGithubProfile] = useState<{ profileUrl: string; displayName: string; publicRepos: number; avatarUrl: string } | null>(null);
  const [githubMessage, setGithubMessage] = useState("");
  const [cvText, setCvText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [parsingResume, setParsingResume] = useState(false);
  const [draggingResume, setDraggingResume] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [typedKeystrokes, setTypedKeystrokes] = useState(0);
  const [pastedCharacters, setPastedCharacters] = useState(0);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [evaluations, setEvaluations] = useState<AnswerEvaluation[]>([]);
  const [currentEvaluation, setCurrentEvaluation] = useState<AnswerEvaluation | null>(null);
  const [report, setReport] = useState<TechnicalAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [startingProctoring, setStartingProctoring] = useState(false);
  const [uploadingRecordings, setUploadingRecordings] = useState(false);
  const [recordingsUploaded, setRecordingsUploaded] = useState(false);
  const proctoringSession = useRef<ProctoringSession | null>(null);
  const cameraPreview = useRef<HTMLVideoElement | null>(null);

  const chatEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (stage === "interview") chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [stage, questionIndex, evaluations.length, currentEvaluation]);

  useEffect(() => {
    if (stage === "interview" && cameraPreview.current && proctoringSession.current) {
      cameraPreview.current.srcObject = proctoringSession.current.cameraStream;
      void cameraPreview.current.play();
    }
  }, [stage]);

  useEffect(() => {
    if (!loading || stage !== "candidate") return;
    const timer = window.setInterval(() => setLoadingStep((step) => Math.min(step + 1, loadingMessages.length - 1)), 3600);
    return () => window.clearInterval(timer);
  }, [loading, stage]);

  const roleTitle = inviteData?.job?.title ?? demoRole.title;
  const roleCompetencies = (inviteData?.job?.competencies as RoleCompetency[] | undefined) ?? demoRole.competencies;
  const currentQuestion = questions[questionIndex];
  const currentCompetency = analysis?.intelligence.competencies.find((item) => item.competency.id === currentQuestion?.competencyId);

  async function chooseRole(jobPostingId: Id<"jobPostings">) {
    setError("");
    try {
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await applyToJob({ jobPostingId, inviteToken: token });
      setSelfServeToken(token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start this application."); }
  }

  function applyToAnotherRole() {
    reset();
    setSelfServeToken(""); setApplicationId(null);
    if (urlInviteToken) window.history.replaceState(null, "", "/apply");
  }

  function reset() {
    if (proctoringSession.current) { void proctoringSession.current.stop(); proctoringSession.current = null; }
    setProctoringEnabled(false); setRecordingsUploaded(false);
    setStage("candidate"); setGithubStatus("idle"); setGithubProfile(null); setGithubMessage(""); setAnalysis(null); setQuestions([]); setEvaluations([]); setReport(null); setQuestionIndex(0); setAnswer(""); setTypedKeystrokes(0); setPastedCharacters(0); setPasteWarning(false); setCurrentEvaluation(null); setError("");
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

  async function enableProctoring() {
    setStartingProctoring(true); setError("");
    try {
      const session = await startProctoring();
      proctoringSession.current = session;
      session.screenStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (proctoringSession.current === session) { setProctoringEnabled(false); setError("Screen sharing stopped. Restart proctoring before continuing the interview."); }
      }, { once: true });
      if (cameraPreview.current) { cameraPreview.current.srcObject = session.cameraStream; await cameraPreview.current.play(); }
      setProctoringEnabled(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "NotAllowedError" ? "Camera and screen access were not granted. Allow both permissions to start the proctored interview." : cause instanceof Error ? cause.message : "Proctoring could not start.");
    } finally { setStartingProctoring(false); }
  }

  async function finishProctoring() {
    if (!proctoringSession.current) return;
    setUploadingRecordings(true);
    try {
      const session = proctoringSession.current;
      proctoringSession.current = null;
      const recordings = await session.stop();
      if (inviteToken && applicationId) {
        for (const recording of recordings) {
          if (!recording.blob.size) continue;
          const uploadUrl = await generateRecordingUploadUrl({ applicationId, inviteToken });
          const uploaded = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": recording.blob.type }, body: recording.blob });
          if (!uploaded.ok) throw new Error(`${recording.type} recording upload failed`);
          const { storageId } = await uploaded.json();
          await saveRecording({ applicationId, inviteToken, type: recording.type, storageId, mimeType: recording.blob.type, size: recording.blob.size, durationMs: recording.durationMs });
        }
        setRecordingsUploaded(true);
      } else setRecordingsUploaded(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Proctoring recordings could not be uploaded."); }
    finally { setUploadingRecordings(false); setProctoringEnabled(false); }
  }

  async function validateGithubInput() {
    setGithubStatus("checking"); setGithubMessage("");
    try {
      const response = await fetch("/api/github/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: githubUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "This GitHub profile could not be validated");
      setGithubProfile(data); setGithubStatus("valid"); setGithubMessage(`${data.publicRepos} public repositories found`);
      return data as { profileUrl: string; displayName: string; publicRepos: number; avatarUrl: string };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "This GitHub profile could not be validated";
      setGithubProfile(null); setGithubStatus("invalid"); setGithubMessage(message);
      throw cause;
    }
  }

  async function analyzeCandidate(event: React.FormEvent) {
    event.preventDefault(); setError("");
    let verifiedGithub;
    try { verifiedGithub = githubStatus === "valid" && githubProfile ? githubProfile : await validateGithubInput(); }
    catch { return; }
    setLoading(true); setLoadingStep(0);
    const candidate: CandidateInput = { id: `candidate-${Date.now()}`, name: name.trim(), cvText: cvText.trim(), githubUrl: verifiedGithub.profileUrl };
    try {
      let data: AnalysisResponse;
      if (inviteToken) {
        const nextApplicationId = await submitProfile({ inviteToken, name: candidate.name, githubUrl: candidate.githubUrl!, cvText: candidate.cvText || undefined });
        setApplicationId(nextApplicationId);
        const result = await analyzeApplication({ applicationId: nextApplicationId, inviteToken });
        data = { ...result, events: [] };
      } else {
        const response = await fetch("/api/intelligence/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidate, role: demoRole }) });
        data = await response.json();
        if (!response.ok) throw new Error((data as unknown as { error?: string }).error || "Analysis failed");
      }
      setAnalysis(data); setQuestions(data.questions); setStage("evidence");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not analyze this candidate. Check the inputs and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleAnswerPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.trim()) return;
    setPastedCharacters((count) => count + pasted.length);
    if (pasted.trim().length >= 40 || pasted.length > Math.max(20, answer.length * 0.5)) setPasteWarning(true);
  }

  function selectCodeChoice(choiceId: string, label: string) {
    if (loading || currentEvaluation) return;
    const selectedAnswer = `${choiceId.toUpperCase()}. ${label}`;
    setAnswer(selectedAnswer);
    void evaluateCurrentAnswer(selectedAnswer);
  }

  async function evaluateCurrentAnswer(answerOverride?: string, questionOverride?: InterviewQuestion, priorEvaluations = evaluations) {
    const submittedAnswer = (answerOverride ?? answer).trim();
    const activeQuestion = questionOverride ?? currentQuestion;
    if (!analysis || !activeQuestion || submittedAnswer.length < 8 || loading) { if (submittedAnswer.length < 8) setError("Add a more complete answer before asking Foxy to evaluate it."); return; }
    setLoading(true); setError("");
    try {
      let data: AnswerEvaluation;
      if (inviteToken && applicationId) data = await evaluateApplicationAnswer({ applicationId, inviteToken, questionId: activeQuestion.id, answer: submittedAnswer });
      else {
        const response = await fetch("/api/interview/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intelligence: analysis.intelligence, question: activeQuestion, answer: submittedAnswer, previousEvaluations: priorEvaluations }) });
        data = await response.json();
        if (!response.ok) throw new Error((data as unknown as { error?: string }).error || "Evaluation failed");
      }
      const completedEvaluations = [...priorEvaluations, data];
      setEvaluations(completedEvaluations); setCurrentEvaluation(data);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      await continueInterview(data, completedEvaluations);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not evaluate this answer."); }
    finally { setLoading(false); }
  }

  async function continueInterview(evaluation: AnswerEvaluation, completedEvaluations: AnswerEvaluation[]) {
    let nextQuestions = questions;
    if (evaluation.followUp && !questions.some((item) => item.id === evaluation.followUp?.id)) {
      nextQuestions = [...questions.slice(0, questionIndex + 1), evaluation.followUp, ...questions.slice(questionIndex + 1)];
      setQuestions(nextQuestions);
    }
    if (questionIndex + 1 < nextQuestions.length) {
      setQuestionIndex((index) => index + 1); setAnswer(""); setTypedKeystrokes(0); setPastedCharacters(0); setPasteWarning(false); setCurrentEvaluation(null);
      return;
    }
    await generateReport(completedEvaluations);
  }

  async function generateReport(completedEvaluations = evaluations) {
    if (!analysis) return;
    setLoading(true); setError("");
    try {
      let data: TechnicalAssessment;
      if (inviteToken && applicationId) data = await finalizeApplication({ applicationId, inviteToken });
      else {
        const response = await fetch("/api/interview/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intelligence: analysis.intelligence, evaluations: completedEvaluations }) });
        data = await response.json();
        if (!response.ok) throw new Error((data as unknown as { error?: string }).error || "Report generation failed");
      }
      await finishProctoring();
      setReport(data); setStage("report");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate the report."); }
    finally { setLoading(false); }
  }

  return (
    <div className="app-shell">
      <AppHeader stage={stage} onReset={reset} />
      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
      {inviteToken && inviteData === null && <div className="error-banner" role="alert"><span>This candidate invitation is invalid or no longer available.</span></div>}

      {stage === "candidate" && !loading && !inviteToken && (
        <main className="role-picker">
          <div className="page-heading"><h1>Choose a role to apply for</h1><p>Every application runs an evidence-backed interview built from your public work. You can apply to as many roles as you like.</p></div>
          {openJobs === undefined ? <div className="dashboard-empty">Loading open roles…</div> : openJobs.length === 0 ? <div className="dashboard-empty"><h2>No open roles right now</h2><p>Ask the hiring team for a direct invitation link.</p></div> : <div className="role-list">{openJobs.map((job) => <article key={job._id}><div><span className="role-type">Open role</span><h2>{job.title}</h2>{job.description && <p>{job.description}</p>}<small>{job.competencyCount} competencies assessed</small></div><button className="primary-button" onClick={() => void chooseRole(job._id)}>Apply <Icon name="arrow" /></button></article>)}</div>}
        </main>
      )}

      {stage === "candidate" && !loading && inviteToken && (
        <main className="workspace candidate-workspace">
          <section className="form-pane">
            <div className="role-context"><span>Application for</span><strong>{roleTitle}</strong></div>
            <div className="page-heading">
              <h1>Show us how you think</h1>
              <p>Share your public GitHub profile and, optionally, your résumé. Foxy will prepare a short technical interview around your actual work.</p>
            </div>
            <form onSubmit={analyzeCandidate} className="candidate-form">
              <div className="field-row">
                <label><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" autoComplete="name" required /></label>
                <label className={`github-field github-${githubStatus}`}><span>GitHub profile</span><div className="input-with-icon"><Icon name="github" /><input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" value={githubUrl} onChange={(event) => { setGithubUrl(event.target.value); setGithubStatus("idle"); setGithubProfile(null); setGithubMessage(""); }} onBlur={() => { if (githubUrl.trim() && githubStatus === "idle") void validateGithubInput().catch(() => {}); }} placeholder="github.com/username" required />{githubStatus === "checking" && <span className="github-spinner button-spinner" />}{githubStatus === "valid" && <span className="github-valid-badge"><Icon name="check" size={14} /></span>}</div>{githubMessage && <small className="github-message">{githubMessage}</small>}</label>
              </div>
              <div className="resume-field">
                <span>Résumé <small>Optional</small></span>
                <label className={`resume-dropzone ${draggingResume ? "dragging" : ""} ${cvText ? "ready" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDraggingResume(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDraggingResume(false); }} onDrop={(event) => { event.preventDefault(); setDraggingResume(false); receiveResume(event.dataTransfer.files); }}>
                  <input type="file" accept=".pdf,.docx,.doc,.rtf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => event.target.files && receiveResume(event.target.files)} />
                  {parsingResume ? <><span className="upload-icon"><span className="button-spinner" /></span><strong>Reading your résumé…</strong><p>Context.dev is extracting the text securely.</p></> : cvText ? <><span className="upload-icon upload-success"><Icon name="check" /></span><strong>{resumeFileName}</strong><p>Résumé ready · {cvText.length.toLocaleString()} characters extracted</p><small>Choose another file</small></> : <><span className="upload-icon"><Icon name="arrow" /></span><strong>Drop your résumé here</strong><p>or click to choose a file</p><small>PDF, DOCX, DOC, RTF, or TXT · max 10 MB</small></>}
                </label>
              </div>
              <div className="form-action"><div><strong>Next: personalized interview</strong><span>Résumé optional · allow around 10 minutes</span></div><button className="primary-button" type="submit" disabled={parsingResume || githubStatus === "checking" || githubStatus === "invalid" || !name.trim() || !githubUrl.trim()}>Prepare my interview <Icon name="arrow" /></button></div>
            </form>
          </section>
          <aside className="method-pane role-pane">
            <span className="role-type">Engineering · Full-time</span>
            <h2>{roleTitle}</h2>
            <p>{inviteData?.job?.description ?? "We’re looking for practical engineering judgment across product interfaces and backend systems."}</p>
            <div className="role-competencies">{roleCompetencies.map((item) => <div key={item.id}><Icon name="check" size={14} /><span>{item.name}</span>{item.required && <small>Core</small>}</div>)}</div>
            <div className="candidate-privacy"><strong>What happens next</strong><p>Your public work helps us ask relevant questions. Missing GitHub evidence will never be treated as proof that a résumé claim is false.</p></div>
          </aside>
        </main>
      )}

      {stage === "candidate" && loading && (
        <main className="analysis-loading">
          <div className="scan-orbit"><FoxyMark size={42} /><i /><i /></div>
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
            <p>Thanks, {analysis.intelligence.candidate.name}. Foxy prepared {questions.length} technical questions for the {roleTitle} role.</p>
            <div className="setup-facts"><div><strong>{questions.length}</strong><span>technical questions</span></div><div><strong>{analysis.intelligence.webEvidence.projects.length}</strong><span>projects reviewed</span></div><div><strong>~10 min</strong><span>estimated time</span></div></div>
            <div className="extraction-overview"><header><div><span>Context.dev extraction</span><strong>Here’s what Foxy found</strong></div><small>{analysis.intelligence.webEvidence.analyzedUrls.length} public pages inspected</small></header><div className="technology-tags">{analysis.intelligence.webEvidence.technologies.length ? analysis.intelligence.webEvidence.technologies.slice(0, 8).map((technology) => <span key={technology}>{technology}</span>) : <small>No languages identified</small>}</div><div className="extracted-projects">{analysis.intelligence.webEvidence.projects.length ? analysis.intelligence.webEvidence.projects.slice(0, 3).map((project) => <article key={project.id}><div><strong>{project.name}</strong><span>{project.strength} evidence</span></div><p>{project.description || project.source.excerpt}</p><small>{project.technologies.slice(0, 4).join(" · ")}</small></article>) : <p className="no-projects">No public projects were available to summarize. Foxy will focus on role fundamentals.</p>}</div></div>
            <div className="proctoring-setup"><video ref={cameraPreview} muted playsInline /><div><span className={`recording-state ${proctoringEnabled ? "active" : ""}`}><i />{proctoringEnabled ? "Camera and screen recording" : "Proctoring required"}</span><p>With your permission, Foxy records your camera and shared screen during the interview for manual recruiter review. No facial or behavioral analysis is performed.</p></div></div>
            {!proctoringEnabled ? <button className="primary-button setup-start" onClick={enableProctoring} disabled={startingProctoring}>{startingProctoring ? "Waiting for permissions…" : "Enable camera & screen"}</button> : <button className="primary-button setup-start" onClick={() => setStage("interview")}>Start proctored interview <Icon name="arrow" /></button>}
          </section>
          <aside className="setup-aside"><h2>Before you begin</h2><div><span>01</span><p>Answer from your own experience. Concrete decisions and trade-offs are more useful than textbook definitions.</p></div><div><span>02</span><p>Type each response in the chat. Foxy moves to the next question automatically after you submit.</p></div><div><span>03</span><p>Foxy may ask a follow-up when an important technical detail needs clarification.</p></div><div><span>04</span><p>Your answers are evaluated for technical substance, not accent, grammar, or speaking style.</p></div></aside>
        </main>
      )}

      {stage === "interview" && analysis && currentQuestion && (
        <main className="chat-layout">
          <aside className="interview-progress-rail" aria-label={`${Math.round(((questionIndex + 1) / questions.length) * 100)}% of interview completed`}><div className="rail-track"><i style={{ height: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div></aside>
          <section className="chat-window">
            <header className="chat-header"><div><span>Foxy technical interview</span><strong>{currentCompetency?.competency.name}</strong></div><div className="chat-header-controls"><div className="proctor-live"><video ref={cameraPreview} muted playsInline /><span><i />REC</span><small>Screen + camera</small></div></div></header>
            <>
              <div className="chat-messages">
                <div className="message message-foxy intro-message"><FoxyMark size={27} /><div><small>Foxy · Technical interviewer</small><p>Hi {analysis.intelligence.candidate.name.split(" ")[0]}, I’m Foxy. I’ll ask a few questions about your experience and the public work connected to your application.</p><p>We’ll begin conversationally, then move into one or two short code questions. Take your time and explain the decisions you made.</p></div></div>
                {evaluations.map((evaluation) => { const question = questions.find((item) => item.id === evaluation.questionId); return question ? <div className="chat-exchange" key={evaluation.questionId}><div className="message message-foxy"><FoxyMark size={27} /><div><small>{analysis.intelligence.role.competencies.find((item) => item.id === question.competencyId)?.name}</small><p>{question.prompt}</p>{question.codeSnippet && <pre className="code-snippet"><code>{question.codeSnippet}</code></pre>}</div></div><div className="message message-candidate"><p>{evaluation.answer}</p></div></div> : null; })}
                {!currentEvaluation && <div className="message message-foxy current"><FoxyMark size={27} /><div><small>{currentQuestion.kind.replaceAll("_", " ")} · {currentCompetency?.competency.name}</small><p>{currentQuestion.prompt}</p>{currentQuestion.codeSnippet && <pre className="code-snippet"><code>{currentQuestion.codeSnippet}</code></pre>}{currentCompetency?.evidence[0] && <em>Based on {currentCompetency.evidence[0].name}</em>}</div></div>}
                {!currentEvaluation && currentQuestion.format === "code_multiple_choice" && <div className="code-choices">{currentQuestion.choices?.map((choice) => <button key={choice.id} onClick={() => selectCodeChoice(choice.id, choice.label)} disabled={loading}><span>{choice.id.toUpperCase()}</span><p>{choice.label}</p></button>)}</div>}
                {currentEvaluation && <div className="answer-saved"><span><Icon name="check" size={15} /></span><div><strong>Answer saved</strong><p>{currentEvaluation.followUp ? "I have one clarifying follow-up." : "Ready for the next question."}</p></div></div>}
                <div ref={chatEnd} aria-hidden="true" />
              </div>
              {currentQuestion.format !== "code_multiple_choice" && <div className="chat-composer"><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} onPaste={handleAnswerPaste} placeholder="Type your answer…" disabled={Boolean(currentEvaluation)} onKeyDown={(event) => { if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) setTypedKeystrokes((count) => count + 1); if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !currentEvaluation) void evaluateCurrentAnswer(); }} />{!currentEvaluation ? <button className="send-button" onClick={() => void evaluateCurrentAnswer()} disabled={loading || answer.trim().length < 8} aria-label="Submit answer">{loading ? <span className="button-spinner" /> : <Icon name="arrow" />}</button> : <div className="auto-advance"><span className="button-spinner" />{questionIndex + 1 < questions.length || currentEvaluation.followUp ? "Preparing next question…" : "Completing interview…"}</div>}<small>⌘ Enter to submit</small>{pasteWarning && <div className="paste-warning" role="alert"><div><strong>Pasted answer detected</strong><p>{pastedCharacters > typedKeystrokes ? "Most of this response appears to have been pasted." : "A large section of this response was pasted."} Please answer in your own words so we can understand your experience.</p></div><button type="button" onClick={() => setPasteWarning(false)}>Dismiss</button></div>}</div>}
            </>
          </section>
        </main>
      )}

      {stage === "report" && report && (
        <main className="completion-layout">
          <span className="completion-mark"><Icon name="check" size={34} /></span>
          <h1>Interview complete</h1>
          <p>Thank you, {analysis?.intelligence.candidate.name}. Your responses have been submitted for the {roleTitle} role.</p>
          <div className="completion-receipt"><div><span>Application</span><strong>{roleTitle}</strong></div><div><span>Responses submitted</span><strong>{evaluations.length}</strong></div><div><span>Proctoring</span><strong>{recordingsUploaded ? inviteToken ? "Camera + screen uploaded" : "Demo recording completed" : "Upload needs review"}</strong></div><div><span>Status</span><strong>{uploadingRecordings ? "Uploading recordings" : "Under review"}</strong></div></div>
          <small>You can close this window. The hiring team will contact you about next steps.</small>
          <button className="secondary-button apply-again" onClick={applyToAnotherRole}><Icon name="refresh" /> Apply to another role</button>
        </main>
      )}
    </div>
  );
}
