import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "./BrandLogo";
import "./marketing.css";

function ArrowIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>;
}

function CheckIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>;
}

export default async function MarketingHome({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  if (invite) redirect(`/apply?invite=${encodeURIComponent(invite)}`);
  return <main className="marketing-page">
    <nav className="marketing-nav"><Link href="/" aria-label="Foxy home"><BrandLogo /></Link><div className="marketing-links"><a href="#how-it-works">How it works</a><a href="#product">Product</a><a href="#technology">Technology</a></div><div className="marketing-actions"><Link href="/recruiter" className="marketing-signin">Sign in</Link><Link href="/recruiter" className="marketing-nav-cta">Start hiring <ArrowIcon /></Link></div></nav>

    <section className="marketing-hero">
      <div className="hero-copy"><span className="hero-note"><i /> Evidence-backed technical interviews</span><h1>Your résumé makes claims. <strong>Foxy asks for receipts.</strong></h1><p>Foxy inspects real public work, asks questions grounded in the candidate’s code, and gives recruiters a technical verdict they can explain.</p><div className="hero-actions"><Link href="/recruiter" className="hero-primary">Create an interview <ArrowIcon /></Link><a href="#product" className="hero-secondary">See the evidence chain</a></div><small>Built for full-stack engineering teams. No generic question banks.</small></div>
      <div className="hero-product" aria-label="Example Foxy candidate verification"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="fox-stage"><BrandLogo size="large"/><span>Reviewing public work…</span></div><article className="signal-card signal-claim"><span>01 · Claim</span><p>“Built scalable Node.js APIs.”</p></article><article className="signal-card signal-evidence"><span>02 · Evidence found</span><div><i /><strong>Express API repository</strong></div><small>Authentication · Error handling · Tests</small></article><article className="signal-card signal-verdict"><span>04 · Verification</span><strong><CheckIcon /> Backend competency verified</strong><small>High confidence</small></article></div>
    </section>

    <section className="partner-ribbon"><span>One transparent chain, powered by</span><strong>Devin</strong><i /><strong>Convex</strong><i /><strong>Context.dev</strong><i /><strong>OpenRouter</strong></section>

    <section className="marketing-problem"><p>Recruiters receive hundreds of engineering CVs.</p><h2>A résumé tells you what someone claims, not whether they understand it.</h2><div><p>Generic AI interviewers ask the same generic questions. Foxy starts with the candidate’s actual repositories, technologies, and decisions, then probes what the evidence supports and what it does not.</p><Link href="/recruiter">Build your first evidence-backed interview <ArrowIcon /></Link></div></section>

    <section className="mechanism" id="how-it-works"><header><span>How Foxy thinks</span><h2>Claim → Evidence → Challenge → Verification</h2></header><div className="mechanism-steps">{[
      ["Claim", "Read the candidate’s résumé and identify specific technical claims."],
      ["Evidence", "Use Context.dev to inspect GitHub projects, tools, tests, and implementation signals."],
      ["Challenge", "Generate role-specific questions tied to the strongest evidence and the important gaps."],
      ["Verification", "Grade technical accuracy, depth, and requirement alignment with every reason attached."],
    ].map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="product-proof" id="product"><div className="proof-copy"><span>Not another résumé score</span><h2>See exactly why a candidate should move forward.</h2><p>Every verdict connects the original claim, public evidence, interview answer, and scoring rationale. Missing evidence creates a better question, not an accusation.</p><ul><li><CheckIcon /> Three-dimensional answer scoring</li><li><CheckIcon /> Separate repository authenticity flags</li><li><CheckIcon /> Must-have competency checks</li><li><CheckIcon /> Recorded camera and screen review</li></ul></div><div className="report-window"><header><BrandLogo mode="Report"/><span>Candidate · Alex Morgan</span></header><div className="report-decision"><span>Recommendation</span><strong>Advance</strong><b>82</b></div><div className="report-skill"><div><strong>React & TypeScript</strong><span>Verified</span></div><i><b style={{width:"91%"}} /></i></div><div className="report-skill"><div><strong>APIs & Backend</strong><span>Verified</span></div><i><b style={{width:"84%"}} /></i></div><div className="report-skill"><div><strong>AWS</strong><span className="review">Human review</span></div><i><b style={{width:"42%"}} /></i></div><blockquote>“Strong implementation depth across React and Node. AWS remains unverified and should be reviewed by a human.”</blockquote></div></section>

    <section className="product-modes"><article><span>For candidates</span><h3>An interview that knows your work.</h3><p>Chat naturally or switch to hands-free voice. Questions adapt to each answer. Code questions appear inline when the role requires them.</p><Link href="/apply">Candidate experience <ArrowIcon /></Link></article><article><span>For hiring teams</span><h3>Live signal, not another black box.</h3><p>Create multiple jobs, invite candidates, follow interviews in real time, and review evidence, scores, transcripts, and recordings.</p><Link href="/recruiter">Recruiter workspace <ArrowIcon /></Link></article></section>

    <section className="technology" id="technology"><header><span>Hackathon stack</span><h2>Each partner technology is essential to the product.</h2></header><div><article><strong>Context.dev</strong><p>Parses uploaded résumés and turns public GitHub work into structured project and technology evidence.</p></article><article><strong>Convex</strong><p>Runs authentication, realtime application state, AI actions, results, transcripts, and recording storage.</p></article><article><strong>Devin</strong><p>Built the candidate experience, interview intelligence, realtime backend, proctoring, and production deployment.</p></article></div></section>

    <section className="marketing-final"><div className="final-fox"><BrandLogo size="large"/></div><span>Stop screening claims.</span><h2>Start verifying understanding.</h2><p>Create your first Full-Stack Engineer interview and invite a candidate in minutes.</p><Link href="/recruiter">Start hiring with Foxy <ArrowIcon /></Link></section>

    <footer className="marketing-footer"><BrandLogo /><p>Evidence-backed technical interviews.</p><span>Built at TheBlock, Dubai · 2026</span></footer>
  </main>;
}
