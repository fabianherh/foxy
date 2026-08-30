"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { demoRole } from "@/lib/intelligence/demo";
import { BrandLogo } from "../BrandLogo";

function RecruiterAuth() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try { await signIn("password", formData); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Authentication failed"); }
    finally { setLoading(false); }
  }
  return <main className="auth-layout"><section><Link className="brand auth-brand" href="/"><BrandLogo /></Link><div><span className="role-type">Recruiter workspace</span><h1>{flow === "signIn" ? "Welcome back" : "Create your workspace"}</h1><p>Manage technical roles, invite candidates, and watch evidence-backed interviews update live.</p></div><form onSubmit={submit}><label><span>Email</span><input name="email" type="email" autoComplete="email" required /></label><label><span>Password</span><input name="password" type="password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} minLength={8} required /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? "Please wait…" : flow === "signIn" ? "Sign in" : "Create account"}</button></form><button className="auth-switch" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>{flow === "signIn" ? "New to Foxy? Create an account" : "Already have an account? Sign in"}</button></section><aside><h2>Claim → Evidence → Challenge → Verification</h2><p>One transparent chain from candidate claims to a recruiter-ready technical decision.</p></aside></main>;
}

function RecruiterDashboard() {
  const { signOut } = useAuthActions();
  const ensureProfile = useMutation(api.applications.ensureRecruiterProfile);
  const createJob = useMutation(api.applications.createJob);
  const createInvite = useMutation(api.applications.createInvite);
  const jobs = useQuery(api.applications.recruiterDashboard);
  const [working, setWorking] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [usingDemo, setUsingDemo] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [openReport, setOpenReport] = useState<Id<"applications"> | null>(null);
  useEffect(() => { void ensureProfile({ companyName: "TheBlock Demo" }); }, [ensureProfile]);

  function fillDemoData() {
    setTitle(demoRole.title);
    setDescription("Build and operate customer-facing products across React, TypeScript, backend APIs, databases, and testing. Candidates should explain practical trade-offs using work they have actually shipped.");
    setSkills(demoRole.competencies.map((item) => item.name).join(", "));
    setUsingDemo(true);
  }

  async function addRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError("");
    try {
      const names = skills.split(",").map((item) => item.trim()).filter(Boolean);
      const competencies = usingDemo ? demoRole.competencies : names.map((name, index) => ({ id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "skill"}-${index}`, name, description: `Required competency: ${name}`, required: true, weight: 1, keywords: [name] }));
      await createJob({ title, description, competencies });
      setTitle(""); setDescription(""); setSkills(""); setUsingDemo(false); setShowComposer(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create this job"); }
    finally { setWorking(false); }
  }

  async function invite(jobPostingId: Id<"jobPostings">) {
    setWorking(true); setError("");
    try {
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await createInvite({ jobPostingId, inviteToken: token });
      await navigator.clipboard.writeText(`${window.location.origin}/apply?invite=${token}`);
      setCopied(token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create an invitation"); }
    finally { setWorking(false); }
  }

  return <main className="recruiter-shell">
    <header><Link className="brand" href="/"><BrandLogo mode="Recruiter" /></Link><div><span className="system-live"><span />Live on Convex</span><button className="text-button" onClick={() => void signOut()}>Sign out</button></div></header>
    <section className="recruiter-head"><div><h1>Technical hiring, with receipts.</h1><p>Create multiple roles, invite candidates, and watch progress update in real time.</p></div><button className="primary-button" onClick={() => setShowComposer((value) => !value)}>{showComposer ? "Close composer" : "Create job"}</button></section>
    {error && <div className="dashboard-error">{error}</div>}
    {showComposer && <section className="job-composer"><header><div><h2>Create a new job</h2><p>Define the role and the competencies Foxy should verify.</p></div><button className="secondary-button" type="button" onClick={fillDemoData}>Fill with demo data</button></header><form onSubmit={addRole}><label><span>Job title</span><input value={title} onChange={(event) => { setTitle(event.target.value); setUsingDemo(false); }} placeholder="e.g. Senior Backend Engineer" required /></label><label><span>Job description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will this person own and what does success look like?" required /></label><label><span>Required competencies</span><input value={skills} onChange={(event) => { setSkills(event.target.value); setUsingDemo(false); }} placeholder="Node.js, PostgreSQL, API design, Testing" required /><small>Separate competencies with commas</small></label><div><button type="button" className="text-button" onClick={() => setShowComposer(false)}>Cancel</button><button className="primary-button" disabled={working}>{working ? "Creating…" : "Create job"}</button></div></form></section>}
    {jobs === undefined ? <div className="dashboard-empty">Loading workspace…</div> : jobs.length === 0 ? <div className="dashboard-empty"><h2>No active roles</h2><p>Create a custom role or use the demo data to start.</p></div> : <section className="job-list">{jobs.map((job) => <article key={job._id} className="job-panel"><header><div><span className="role-type">Open role</span><h2>{job.title}</h2>{job.description && <p className="job-description">{job.description}</p>}<p>{job.competencies.length} competencies · {job.applications.length} applications</p></div><button className="secondary-button" onClick={() => invite(job._id)} disabled={working}>Copy candidate invite</button></header><div className="application-table"><div className="table-head"><span>Candidate</span><span>Status</span><span>Score</span><span>Recommendation</span><span>Proctoring</span></div>{job.applications.length === 0 ? <div className="table-empty">No candidates yet. Copy an invite to start.</div> : job.applications.map((application) => {
      const report = application.result?.data;
      const expanded = openReport === application._id;
      return <div key={application._id}>
        <button type="button" className={`application-row application-row-button ${expanded ? "expanded" : ""}`} onClick={() => setOpenReport(expanded ? null : application._id)}><span>{application.candidate?.name ?? "Invite pending"}<small>{application.candidate?.githubUrl ?? "Waiting for candidate"}</small></span><span><i className={`application-status status-${application.status}`} />{application.status.replaceAll("_", " ")}</span><span>{application.result?.overallScore ?? "Not available"}</span><span>{application.result?.recommendation?.replaceAll("_", " ") ?? "Not available"}</span><span className="recording-links">{application.recordings.length ? application.recordings.map((recording) => recording.url ? <a key={recording.type} href={recording.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{recording.type}</a> : null) : "Not available"}</span></button>
        {expanded && <div className="report-detail">
          {!report ? <p className="report-pending">The full report appears here when the interview is completed{application.transcript.length ? ` · ${application.transcript.length} answers so far` : ""}.</p> : <>
            <header><div><span>Recommendation</span><strong className={`recommendation recommendation-${report.recommendation}`}>{report.recommendation.replaceAll("_", " ")}</strong></div><div><span>Overall score</span><b>{report.overallScore}</b></div></header>
            <p className="report-summary">{report.summary}</p>
            <div className="report-columns">
              <div><h4>Strengths</h4>{report.strengths.length ? report.strengths.map((item: string) => <p key={item}>{item}</p>) : <p>None verified yet.</p>}</div>
              <div><h4>Concerns</h4>{report.risks.length ? report.risks.map((item: string) => <p key={item}>{item}</p>) : <p>No flagged concerns.</p>}</div>
            </div>
            <div className="competency-verdicts"><h4>Competency verdicts</h4>{report.competencies.map((verdict: { competencyId: string; competencyName: string; status: string; score: number; confidence: number }) => <div key={verdict.competencyId}><span>{verdict.competencyName}</span><i><b style={{ width: `${verdict.score}%` }} /></i><small>{verdict.score}/100 · {verdict.status.replaceAll("_", " ")} · {Math.round(verdict.confidence * 100)}%</small></div>)}</div>
            {report.authenticityFlags?.length > 0 && <div className="authenticity-flags"><h4>Repository authenticity flags</h4>{report.authenticityFlags.map((flag: { questionId: string; rationale: string }) => <p key={flag.questionId}>{flag.rationale}</p>)}</div>}
          </>}
          {application.transcript.length > 0 && <div className="report-transcript"><h4>Interview transcript</h4>{application.transcript.map((entry) => <div key={entry.questionId}><p className="transcript-question">{entry.prompt}</p><p className="transcript-answer">{entry.answer}</p>{entry.score !== null && <small>{entry.score}/10{entry.status ? ` · ${String(entry.status).replaceAll("_", " ")}` : ""}</small>}</div>)}</div>}
        </div>}
      </div>;
    })}</div>{copied && job.applications.some((application) => application.inviteToken === copied) && <p className="copy-notice">Invite copied. Open it in a private window to test the candidate flow.</p>}</article>)}</section>}
  </main>;
}

export default function RecruiterPage() {
  return <><AuthLoading><main className="auth-loading">Connecting to Convex…</main></AuthLoading><Unauthenticated><RecruiterAuth /></Unauthenticated><Authenticated><RecruiterDashboard /></Authenticated></>;
}
