import type { CandidateInput, RoleDefinition, WebEvidenceBundle } from "./types";

export const demoRole: RoleDefinition = {
  id: "role-full-stack",
  title: "Full-Stack Software Engineer",
  competencies: [
    { id: "react", name: "React", description: "Builds maintainable, accessible React interfaces with sound state and rendering decisions.", required: true, weight: 1, keywords: ["React", "Next.js", "components", "state", "frontend"] },
    { id: "typescript", name: "TypeScript", description: "Uses static types to model domains and reduce runtime errors.", required: true, weight: 1, keywords: ["TypeScript", "types", "interfaces", "generics"] },
    { id: "backend", name: "APIs & Backend", description: "Designs reliable backend services, API contracts, authentication, and error handling.", required: true, weight: 1.2, keywords: ["Node.js", "Express", "NestJS", "API", "REST", "authentication"] },
    { id: "databases", name: "Databases", description: "Models, queries, and evolves relational or document data safely.", required: true, weight: 1, keywords: ["PostgreSQL", "SQL", "MongoDB", "Prisma", "database"] },
    { id: "testing", name: "Testing", description: "Chooses effective unit, integration, and end-to-end testing strategies.", required: true, weight: 1, keywords: ["testing", "Jest", "Vitest", "Playwright", "integration tests"] },
    { id: "docker", name: "Docker", description: "Packages applications into reproducible, secure containers.", required: false, weight: 0.4, keywords: ["Docker", "Dockerfile", "containers", "Compose"] },
    { id: "aws", name: "AWS", description: "Deploys and operates production workloads using appropriate AWS services.", required: false, weight: 0.4, keywords: ["AWS", "Lambda", "EC2", "S3", "CloudFront"] },
  ],
};

export const demoCandidate: CandidateInput = {
  id: "candidate-alex-morgan",
  name: "Alex Morgan",
  githubUrl: "https://github.com/vercel/next.js",
  cvText: "Full-stack software engineer with five years of experience. Built scalable Node.js APIs with authentication and structured error handling. Led React and TypeScript frontend development for a customer analytics platform. Designed PostgreSQL schemas and optimized SQL queries. Established Jest and Playwright testing practices. Containerized services using Docker and deployed production workloads on AWS.",
};

export function createDemoEvidence(): WebEvidenceBundle {
  const extractedAt = Date.now();
  return {
    provider: "demo_fallback",
    analyzedUrls: [demoCandidate.githubUrl!],
    extractedAt,
    technologies: ["React", "TypeScript", "Node.js", "Next.js", "Jest"],
    webClaims: [
      { id: "web-claim-react", statement: "Maintains a React and TypeScript web application.", technologies: ["React", "TypeScript"], source: "github" },
      { id: "web-claim-node", statement: "Implements Node.js server routes and APIs.", technologies: ["Node.js", "API"], source: "github" },
    ],
    projects: [
      {
        id: "evidence-web-platform",
        name: "customer-platform",
        description: "Full-stack TypeScript application with React components, server routes, typed API contracts, and PostgreSQL persistence.",
        url: "https://github.com/example/customer-platform",
        technologies: ["React", "TypeScript", "Node.js", "PostgreSQL", "Jest", "Playwright"],
        signals: ["Typed React components", "Node.js API routes", "Database migrations", "Unit and end-to-end tests"],
        strength: "strong",
        source: { url: "https://github.com/example/customer-platform", title: "customer-platform", excerpt: "TypeScript application with app routes, database migrations, Jest tests, and Playwright specs.", sourceType: "repository" },
      },
      {
        id: "evidence-docker",
        name: "service-prototype",
        description: "Small Node.js prototype containing a basic Dockerfile but no orchestration or production deployment configuration.",
        url: "https://github.com/example/service-prototype",
        technologies: ["Node.js", "Docker"],
        signals: ["Single-stage Dockerfile"],
        strength: "weak",
        source: { url: "https://github.com/example/service-prototype", title: "service-prototype", excerpt: "FROM node:20; COPY . .; CMD npm start", sourceType: "repository" },
      },
    ],
  };
}
