import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireText, stringList } from "./utils";
import { jobStatusValidator } from "./validators";

export const createJob = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    requiredSkills: v.array(v.string()),
    experienceLevel: v.string(),
    status: v.optional(jobStatusValidator),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobs", {
      title: requireText(args.title, "title"),
      description: requireText(args.description, "description"),
      requiredSkills: stringList(args.requiredSkills, "requiredSkills"),
      experienceLevel: requireText(args.experienceLevel, "experienceLevel"),
      status: args.status ?? "open",
      createdAt: Date.now(),
    });
  },
});

export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => await ctx.db.get(args.jobId),
});

export const listJobs = query({
  args: { status: v.optional(jobStatusValidator) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("jobs").order("desc").collect();
  },
});
