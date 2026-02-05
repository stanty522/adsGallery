import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run sync every 15 minutes
crons.interval(
  "sync-creatives",
  { minutes: 15 },
  internal.syncJob.run
);

export default crons;
