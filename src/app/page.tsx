import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "./BrandLogo";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/marketing/reveal";
import { FloatCard } from "@/components/marketing/float-card";
import { PartnerMarquee } from "@/components/marketing/partner-marquee";
import { TimelineStep } from "@/components/marketing/timeline-step";
import { SkillBar } from "@/components/marketing/skill-bar";
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
      <div className="hero-copy"><Reveal as="span" className="hero-note" y={14}><i /> Evidence-backed technical interviews</Reveal><Reveal as="h1" y={30} blur delay={0.08}>Your résumé makes claims. <strong>Foxy asks for receipts.</strong></Reveal><Reveal as="p" y={22} delay={0.18}>Foxy inspects real public work, asks questions grounded in the candidate’s code, and gives recruiters a technical verdict they can explain.</Reveal><Reveal as="div" className="hero-actions" y={18} delay={0.28}><Link href="/recruiter" className="hero-primary">Create an interview <ArrowIcon /></Link><a href="#product" className="hero-secondary">See the evidence chain</a></Reveal><Reveal as="small" y={12} delay={0.38}>Built for full-stack engineering teams. No generic question banks.</Reveal></div>
      <Reveal as="div" className="hero-product" y={30} delay={0.15} aria-label="Example Foxy candidate verification"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="fox-stage"><BrandLogo size="large"/><span>Reviewing public work…</span></div><FloatCard className="signal-card signal-claim" rotate={-2} delay={0.55}><span>01 · Claim</span><p>“Built scalable Node.js APIs.”</p></FloatCard><FloatCard className="signal-card signal-evidence" rotate={1.5} delay={0.75} floatDelay={1.6}><span>02 · Evidence found</span><div><i /><strong>Express API repository</strong></div><small>Authentication · Error handling · Tests</small></FloatCard><FloatCard className="signal-card signal-verdict" rotate={1} delay={0.95} floatDelay={3.1}><span>04 · Verification</span><strong><CheckIcon /> Backend competency verified</strong><small>High confidence</small></FloatCard></Reveal>
    </section>

    <section className="partner-ribbon"><span>One transparent chain, powered by</span><PartnerMarquee partners={["Devin", "Convex", "Context.dev", "OpenRouter"]} /></section>

    <section className="marketing-problem"><p>Recruiters receive hundreds of engineering CVs.</p><h2>A résumé tells you what someone claims, not whether they understand it.</h2><div><p>Generic AI interviewers ask the same generic questions. Foxy starts with the candidate’s actual repositories, technologies, and decisions, then probes what the evidence supports and what it does not.</p><Link href="/recruiter">Build your first evidence-backed interview <ArrowIcon /></Link></div></section>

    <section className="mechanism" id="how-it-works"><header><span>How Foxy thinks</span><h2>Claim → Evidence → Challenge → Verification</h2></header><div className="mechanism-steps">{[
      ["Claim", "Read the candidate’s résumé and identify specific technical claims."],
      ["Evidence", "Use Context.dev to inspect GitHub projects, tools, tests, and implementation signals."],
      ["Challenge", "Generate role-specific questions tied to the strongest evidence and the important gaps."],
      ["Verification", "Grade technical accuracy, depth, and requirement alignment with every reason attached."],
    ].map(([title, text], index) => <TimelineStep key={title} index={index} title={title}>{text}</TimelineStep>)}</div></section>

    <section className="product-proof" id="product"><Reveal as="div" className="proof-copy" y={26}><span>Not another résumé score</span><h2>See exactly why a candidate should move forward.</h2><p>Every verdict connects the original claim, public evidence, interview answer, and scoring rationale. Missing evidence creates a better question, not an accusation.</p><ul><li><CheckIcon /> Three-dimensional answer scoring</li><li><CheckIcon /> Separate repository authenticity flags</li><li><CheckIcon /> Must-have competency checks</li><li><CheckIcon /> Recorded camera and screen review</li></ul></Reveal><Reveal as="div" className="report-window" y={34} delay={0.12}><header><BrandLogo mode="Report"/><span>Candidate · Alex Morgan</span></header><div className="report-decision"><span>Recommendation</span><strong>Advance</strong><b><CountUp to={82} /></b></div><div className="report-skill"><div><strong>React & TypeScript</strong><span>Verified</span></div><SkillBar width={91} delay={0.2} /></div><div className="report-skill"><div><strong>APIs & Backend</strong><span>Verified</span></div><SkillBar width={84} delay={0.35} /></div><div className="report-skill"><div><strong>AWS</strong><span className="review">Human review</span></div><SkillBar width={42} delay={0.5} /></div><blockquote>“Strong implementation depth across React and Node. AWS remains unverified and should be reviewed by a human.”</blockquote></Reveal></section>

    <section className="product-modes"><article><span>For candidates</span><h3>An interview that knows your work.</h3><p>Chat naturally or switch to hands-free voice. Questions adapt to each answer. Code questions appear inline when the role requires them.</p><Link href="/apply">Candidate experience <ArrowIcon /></Link></article><article><span>For hiring teams</span><h3>Live signal, not another black box.</h3><p>Create multiple jobs, invite candidates, follow interviews in real time, and review evidence, scores, transcripts, and recordings.</p><Link href="/recruiter">Recruiter workspace <ArrowIcon /></Link></article></section>

    <section className="technology" id="technology"><header><span>Hackathon stack</span><h2>Each partner technology is essential to the product.</h2></header><div><article><strong>Context.dev</strong><p>Parses uploaded résumés and turns public GitHub work into structured project and technology evidence.</p></article><article><strong>Convex</strong><p>Runs authentication, realtime application state, AI actions, results, transcripts, and recording storage.</p></article><article><strong>Devin</strong><p>Built the candidate experience, interview intelligence, realtime backend, proctoring, and production deployment.</p></article></div></section>

    <section className="marketing-final"><Reveal as="div" className="final-fox" y={26}><BrandLogo size="large"/></Reveal><Reveal as="span" y={18} delay={0.1}>Stop screening claims.</Reveal><Reveal as="h2" y={26} blur delay={0.18}>Start verifying understanding.</Reveal><Reveal as="p" y={18} delay={0.28}>Create your first Full-Stack Engineer interview and invite a candidate in minutes.</Reveal><Reveal as="div" y={16} delay={0.38}><Link href="/recruiter">Start hiring with Foxy <ArrowIcon /></Link></Reveal></section>

    <footer className="marketing-footer"><BrandLogo /><p>Evidence-backed technical interviews.</p><span>Built at TheBlock, Dubai · 2026</span></footer>
  </main>;
}
