import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getProcessedIds = query({
  handler: async (ctx) => {
    const files = await ctx.db.query("syncedFiles").collect();
    return files.map((f) => f.fileId);
  },
});

export const markAsProcessed = mutation({
  args: {
    files: v.array(
      v.object({
        fileId: v.string(),
        type: v.string(),
      })
    ),
  },
  handler: async (ctx, { files }) => {
    const now = Date.now();
    for (const file of files) {
      await ctx.db.insert("syncedFiles", {
        fileId: file.fileId,
        type: file.type,
        syncedAt: now,
      });
    }
  },
});

// Internal versions for the cron job action
export const getProcessedIdsInternal = internalQuery({
  handler: async (ctx) => {
    const files = await ctx.db.query("syncedFiles").collect();
    return files.map((f) => f.fileId);
  },
});

export const markProcessedInternal = internalMutation({
  args: {
    files: v.array(v.object({ fileId: v.string(), type: v.string() })),
  },
  handler: async (ctx, { files }) => {
    const now = Date.now();
    for (const file of files) {
      await ctx.db.insert("syncedFiles", {
        fileId: file.fileId,
        type: file.type,
        syncedAt: now,
      });
    }
  },
});
