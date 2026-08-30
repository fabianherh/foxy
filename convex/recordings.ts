import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function requireApplication(ctx: MutationCtx, applicationId: Id<"applications">, inviteToken: string) {
  const application = await ctx.db.get(applicationId);
  if (!application || !("inviteToken" in application) || application.inviteToken !== inviteToken) throw new Error("Invalid invitation");
  return application;
}

export const generateUploadUrl = mutation({
  args: { applicationId: v.id("applications"), inviteToken: v.string() },
  handler: async (ctx, args) => {
    await requireApplication(ctx, args.applicationId, args.inviteToken);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveRecording = mutation({
  args: { applicationId: v.id("applications"), inviteToken: v.string(), type: v.union(v.literal("camera"), v.literal("screen")), storageId: v.id("_storage"), mimeType: v.string(), size: v.number(), durationMs: v.number() },
  handler: async (ctx, args) => {
    await requireApplication(ctx, args.applicationId, args.inviteToken);
    if (!(await ctx.db.system.get(args.storageId))) throw new Error("Uploaded recording not found");
    return await ctx.db.insert("recordings", { applicationId: args.applicationId, type: args.type, storageId: args.storageId, mimeType: args.mimeType, size: args.size, durationMs: args.durationMs, createdAt: Date.now() });
  },
});
