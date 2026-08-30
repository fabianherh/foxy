import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail } from "./utils";

export const generateCvUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const attachCandidateCv = mutation({
  args: {
    candidateId: v.id("candidates"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      fail("NOT_FOUND", "Candidate not found");
    }
    if (!(await ctx.db.system.get(args.storageId))) {
      fail("NOT_FOUND", "Uploaded CV file not found");
    }
    if (candidate.cvStorageId && candidate.cvStorageId !== args.storageId) {
      await ctx.storage.delete(candidate.cvStorageId);
    }
    await ctx.db.patch(args.candidateId, { cvStorageId: args.storageId });
    return args.candidateId;
  },
});

export const getCandidateCvUrl = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      fail("NOT_FOUND", "Candidate not found");
    }
    return candidate.cvStorageId
      ? await ctx.storage.getUrl(candidate.cvStorageId)
      : null;
  },
});
