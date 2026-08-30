import type { CandidateClaim, CandidateInput, CandidateIntelligence, ClaimEvidenceLink, CompetencyEvidence, EvidenceStrength, ProjectEvidence, RoleDefinition, VerificationStatus, WebEvidenceBundle } from "./types";

const aliases: Record<string, string[]> = {
  react: ["react", "next.js", "nextjs", "jsx", "tsx"],
  typescript: ["typescript", "tsx", "ts"],
  javascript: ["javascript", "ecmascript", "js"],
  node: ["node", "node.js", "nodejs", "express", "nestjs", "nest.js"],
  api: ["api", "apis", "rest", "graphql", "express", "nestjs", "endpoint"],
  database: ["database", "databases", "postgres", "postgresql", "mysql", "mongodb", "prisma", "drizzle", "sql"],
  testing: ["testing", "tests", "jest", "vitest", "playwright", "cypress", "pytest"],
  docker: ["docker", "dockerfile", "container", "containers", "compose"],
  aws: ["aws", "amazon web services", "lambda", "ec2", "s3", "cloudfront"],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(/\s+/).map((token) => token.replace(/^\.+|\.+$/g, "")).filter(Boolean).join(" ");
}

function termsFor(values: string[]): string[] {
  const normalized = values.flatMap((value) => {
    const key = normalize(value);
    return [key, ...(aliases[key] ?? [])];
  });
  return [...new Set(normalized.map(normalize).filter((term) => term.length > 1))];
}

function containsTerm(text: string, term: string): boolean {
  const haystack = ` ${normalize(text)} `;
  const needle = ` ${normalize(term)} `;
  return haystack.includes(needle);
}

function strengthRank(strength: EvidenceStrength): number {
  return { none: 0, weak: 1, moderate: 2, strong: 3 }[strength];
}

function maxStrength(evidence: ProjectEvidence[]): EvidenceStrength {
  return evidence.reduce<EvidenceStrength>((best, item) => strengthRank(item.strength) > strengthRank(best) ? item.strength : best, "none");
}

export function extractCvClaims(cvText: string): CandidateClaim[] {
  const lines = cvText.split(/\n|(?<=[.!?])\s+/).map((line) => line.replace(/^[-•*\s]+/, "").trim()).filter((line) => line.length >= 15 && line.length <= 500);
  const technicalTerms = [...new Set(Object.values(aliases).flat())];
  return lines.filter((line) => technicalTerms.some((term) => containsTerm(line, term))).slice(0, 30).map((statement, index) => ({
    id: `cv-claim-${index}`,
    statement,
    technologies: technicalTerms.filter((term) => containsTerm(statement, term)).map((term) => Object.entries(aliases).find(([, values]) => values.includes(term))?.[0] ?? term).filter((value, position, values) => values.indexOf(value) === position),
    source: "cv",
  }));
}

export function linkClaimsToEvidence(claims: CandidateClaim[], projects: ProjectEvidence[]): ClaimEvidenceLink[] {
  return claims.map((claim) => {
    const terms = termsFor(claim.technologies.length ? claim.technologies : claim.statement.split(/\s+/).filter((word) => word.length > 4));
    const evidence = projects.filter((project) => {
      const searchable = [project.name, project.description, ...project.technologies, ...project.signals, project.source.excerpt].join(" ");
      return terms.some((term) => containsTerm(searchable, term));
    });
    const strength = maxStrength(evidence);
    return {
      claim,
      evidence,
      strength,
      rationale: evidence.length
        ? `${evidence.length} public project${evidence.length === 1 ? "" : "s"} support this claim; strongest evidence is ${strength}.`
        : "No matching public implementation evidence was found. This is not proof the claim is false; it requires interview verification.",
    };
  });
}

function statusForStrength(strength: EvidenceStrength): VerificationStatus {
  if (strength === "strong") return "verified";
  if (strength === "moderate" || strength === "weak") return "partially_verified";
  return "unverified";
}

export function mapCompetencies(role: RoleDefinition, claims: CandidateClaim[], projects: ProjectEvidence[]): CompetencyEvidence[] {
  return role.competencies.map((competency) => {
    const terms = termsFor([competency.name, ...competency.keywords]);
    const matchingClaims = claims.filter((claim) => terms.some((term) => containsTerm(`${claim.statement} ${claim.technologies.join(" ")}`, term)));
    const matchingEvidence = projects.filter((project) => terms.some((term) => containsTerm(`${project.name} ${project.description} ${project.technologies.join(" ")} ${project.signals.join(" ")}`, term)));
    const strength = maxStrength(matchingEvidence);
    const hasClaimWithoutEvidence = matchingClaims.length > 0 && matchingEvidence.length === 0;
    return {
      competency,
      status: statusForStrength(strength),
      strength,
      claims: matchingClaims,
      evidence: matchingEvidence,
      rationale: matchingEvidence.length
        ? `${competency.name} is supported by ${matchingEvidence.length} public artifact${matchingEvidence.length === 1 ? "" : "s"}; strongest evidence is ${strength}.`
        : hasClaimWithoutEvidence
          ? `${competency.name} is claimed on the CV but has no matching public artifact, so the interview must verify it.`
          : `No claim or public evidence for ${competency.name} was found; probe fundamentals before drawing a conclusion.`,
    };
  });
}

export function buildCandidateIntelligence(candidate: CandidateInput, role: RoleDefinition, webEvidence: WebEvidenceBundle): CandidateIntelligence {
  const claims = [...extractCvClaims(candidate.cvText), ...webEvidence.webClaims];
  return {
    candidate,
    role,
    claims,
    webEvidence,
    claimEvidence: linkClaimsToEvidence(claims.filter((claim) => claim.source === "cv"), webEvidence.projects),
    competencies: mapCompetencies(role, claims, webEvidence.projects),
  };
}
