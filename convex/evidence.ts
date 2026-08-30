import { Infer, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { fail, requireHttpUrl, requireText } from "./utils";
import {
  evidenceFields,
  evidenceInputValidator,
} from "./validators";

type EvidenceInput = Infer<typeof evidenceInputValidator>;

async function upsertEvidence(
  ctx: MutationCtx,
  candidateId: Id<"candidates">,
  input: EvidenceInput,
) {
  const evidence = {
    skill: requireText(input.skill, "skill"),
    claim: requireText(input.claim, "claim"),
    source: requireText(input.source, "source"),
    evidenceUrl: requireHttpUrl(input.evidenceUrl, "evidenceUrl"),
    evidenceText: requireText(input.evidenceText, "evidenceText"),
    strength: input.strength,
    verificationStatus: input.verificationStatus,
  };
  const matches = await ctx.db
    .query("evidence")
    .withIndex("by_candidate_skill", (q) =>
      q.eq("candidateId", candidateId).eq("skill", evidence.skill),
    )
    .collect();
  const existing = matches.find(
    (item) =>
      item.claim === evidence.claim && item.source === evidence.source,
  );
  if (existing) {
    await ctx.db.patch(existing._id, evidence);
    return existing._id;
  }
  return await ctx.db.insert("evidence", {
    candidateId,
    ...evidence,
    createdAt: Date.now(),
  });
}

export const saveEvidence = mutation({
  args: { candidateId: v.id("candidates"), ...evidenceFields },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.candidateId))) {
      fail("NOT_FOUND", "Candidate not found");
    }
    const { candidateId, ...input } = args;
    return await upsertEvidence(ctx, candidateId, input);
  },
});

export const saveEvidenceBatch = mutation({
  args: {
    candidateId: v.id("candidates"),
    evidence: v.array(evidenceInputValidator),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.candidateId))) {
      fail("NOT_FOUND", "Candidate not found");
    }
    const evidenceIds = [];
    for (const input of args.evidence) {
      evidenceIds.push(await upsertEvidence(ctx, args.candidateId, input));
    }
    return { evidenceIds, count: evidenceIds.length };
  },
});

export const getCandidateEvidence = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("evidence")
      .withIndex("by_candidate", (q) =>
        q.eq("candidateId", args.candidateId),
      )
      .collect(),
});
