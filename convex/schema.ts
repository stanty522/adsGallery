import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  syncedFiles: defineTable({
    fileId: v.string(),
    type: v.string(), // "thumb" | "video"
    syncedAt: v.number(),
  }).index("by_fileId", ["fileId"]),
});
