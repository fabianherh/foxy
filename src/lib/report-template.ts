import type { TechnicalAssessment } from "./intelligence/types";

export interface ReportTranscriptEntry {
  questionId: string;
  sequence: number;
  prompt: string;
  answer: string;
  score: number | null;
  status: string | null;
}

export interface ReportDocumentInput {
  candidateName: string;
  githubUrl: string;
  roleTitle: string;
  report: TechnicalAssessment;
  transcript: ReportTranscriptEntry[];
  recordings: Array<{ type: string; url: string | null }>;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const label = (value: string) => escapeHtml(value.replaceAll("_", " "));

const listItems = (items: string[], emptyText: string) =>
  items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li class="muted">${escapeHtml(emptyText)}</li>`;

const REPORT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{{DOC_TITLE}}</title>
<style>
  :root { --ink: #2b1d2e; --muted: #7c6a7f; --coral: #e8604c; --plum: #4d2d52; --line: #e9dde4; --wash: #faf5f1; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 48px 56px; font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif; color: var(--ink); background: #fff; font-size: 14px; line-height: 1.55; }
  header.doc { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid var(--plum); padding-bottom: 18px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 800; color: var(--plum); letter-spacing: 0.02em; }
  .brand span { color: var(--coral); }
  .doc-meta { text-align: right; color: var(--muted); font-size: 12px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--plum); border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 28px 0 12px; }
  .muted { color: var(--muted); }
  .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; }
  .fact { background: var(--wash); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .fact span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 4px; }
  .fact strong { font-size: 16px; }
  .verdict-band { display: flex; align-items: center; gap: 18px; background: var(--plum); color: #fff; border-radius: 12px; padding: 16px 20px; margin-top: 18px; }
  .verdict-band .score { font-size: 34px; font-weight: 800; }
  .verdict-band .rec { font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; background: var(--coral); border-radius: 999px; padding: 5px 14px; font-weight: 700; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); border-bottom: 1px solid var(--line); padding: 6px 8px; }
  td { border-bottom: 1px solid var(--line); padding: 8px; vertical-align: top; }
  .bar { position: relative; display: inline-block; background: var(--line); border-radius: 999px; height: 8px; width: 120px; overflow: hidden; }
  .bar i { position: absolute; inset: 0 auto 0 0; background: var(--coral); border-radius: 999px; }
  .flag { background: #fdf1ec; border: 1px solid #f3c9bc; border-left: 4px solid var(--coral); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
  .qa { border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .qa .q { font-weight: 700; margin-bottom: 6px; }
  .qa .a { white-space: pre-wrap; }
  .qa small { color: var(--muted); display: block; margin-top: 8px; }
  footer.doc { margin-top: 36px; border-top: 1px solid var(--line); padding-top: 12px; font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; }
  .print-hint { background: var(--wash); border: 1px dashed var(--line); border-radius: 10px; padding: 10px 14px; font-size: 12px; color: var(--muted); margin-bottom: 20px; }
  @media print { .print-hint { display: none; } body { padding: 24px 28px; } }
</style>
</head>
<body>
<div class="print-hint">To save as PDF: press Ctrl/Cmd&nbsp;+&nbsp;P and choose “Save as PDF”.</div>
<header class="doc">
  <div>
    <div class="brand">Foxy<span>.</span></div>
    <div class="muted">Evidence-backed technical vetting report</div>
  </div>
  <div class="doc-meta">
    Generated {{GENERATED_AT}}<br />
    Claim → Evidence → Challenge → Verification
  </div>
</header>

<h1>{{CANDIDATE_NAME}}</h1>
<div class="muted">{{GITHUB_URL}}</div>

<div class="facts">
  <div class="fact"><span>Role</span><strong>{{ROLE_TITLE}}</strong></div>
  <div class="fact"><span>Questions answered</span><strong>{{ANSWER_COUNT}}</strong></div>
  <div class="fact"><span>Proctoring artifacts</span><strong>{{RECORDING_SUMMARY}}</strong></div>
</div>

<div class="verdict-band">
  <div class="score">{{OVERALL_SCORE}}<small style="font-size:14px;font-weight:500">/100</small></div>
  <div class="rec">{{RECOMMENDATION}}</div>
  <div>{{SUMMARY}}</div>
</div>

<div class="columns">
  <section>
    <h2>Verified strengths</h2>
    <ul>{{STRENGTHS}}</ul>
  </section>
  <section>
    <h2>Concerns</h2>
    <ul>{{RISKS}}</ul>
  </section>
</div>

<section>
  <h2>Competency verdicts</h2>
  <table>
    <thead><tr><th>Competency</th><th>Score</th><th></th><th>Status</th><th>Must-have</th><th>Confidence</th></tr></thead>
    <tbody>{{COMPETENCY_ROWS}}</tbody>
  </table>
</section>

<section>
  <h2>Repository authenticity</h2>
  {{AUTHENTICITY_FLAGS}}
</section>

<section>
  <h2>Interview transcript</h2>
  {{TRANSCRIPT}}
</section>

<footer class="doc">
  <span>Foxy · AI technical interviewer · foxy-ten.vercel.app</span>
  <span>Confidential — for hiring team review only</span>
</footer>
</body>
</html>`;

export function renderReportHtml(input: ReportDocumentInput): string {
  const { report, transcript, recordings } = input;
  const competencyRows = report.competencies
    .map(
      (verdict) =>
        `<tr><td>${escapeHtml(verdict.competencyName)}</td><td><b>${Math.round(verdict.score)}</b>/100</td><td><span class="bar"><i style="width:${Math.max(0, Math.min(100, Math.round(verdict.score)))}%"></i></span></td><td>${label(String(verdict.status))}</td><td>${verdict.mustHave ? (verdict.demonstrated ? "Demonstrated" : "Not demonstrated") : "—"}</td><td>${Math.round(verdict.confidence * 100)}%</td></tr>`,
    )
    .join("");
  const authenticityFlags = report.authenticityFlags?.length
    ? report.authenticityFlags.map((flag) => `<div class="flag">${escapeHtml(flag.rationale)}</div>`).join("")
    : `<p class="muted">No inconsistencies with repository evidence were flagged.</p>`;
  const transcriptBlocks = transcript.length
    ? [...transcript]
        .sort((a, b) => a.sequence - b.sequence)
        .map(
          (entry, index) =>
            `<div class="qa"><div class="q">Q${index + 1}. ${escapeHtml(entry.prompt)}</div><div class="a">${escapeHtml(entry.answer)}</div>${entry.score !== null ? `<small>Score ${entry.score}/10${entry.status ? ` · ${label(entry.status)}` : ""}</small>` : ""}</div>`,
        )
        .join("")
    : `<p class="muted">No transcript recorded.</p>`;
  const recordingSummary = recordings.filter((recording) => recording.url).map((recording) => recording.type).join(" + ") || "None";
  const replacements: Record<string, string> = {
    DOC_TITLE: `Foxy report — ${escapeHtml(input.candidateName)}`,
    GENERATED_AT: escapeHtml(new Date(report.generatedAt || Date.now()).toLocaleString()),
    CANDIDATE_NAME: escapeHtml(input.candidateName),
    GITHUB_URL: escapeHtml(input.githubUrl),
    ROLE_TITLE: escapeHtml(input.roleTitle),
    ANSWER_COUNT: String(transcript.length),
    RECORDING_SUMMARY: escapeHtml(recordingSummary),
    OVERALL_SCORE: String(Math.round(report.overallScore)),
    RECOMMENDATION: label(String(report.recommendation)),
    SUMMARY: escapeHtml(report.summary),
    STRENGTHS: listItems(report.strengths, "None verified yet."),
    RISKS: listItems(report.risks, "No flagged concerns."),
    COMPETENCY_ROWS: competencyRows,
    AUTHENTICITY_FLAGS: authenticityFlags,
    TRANSCRIPT: transcriptBlocks,
  };
  return REPORT_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, key: string) => replacements[key] ?? "");
}
