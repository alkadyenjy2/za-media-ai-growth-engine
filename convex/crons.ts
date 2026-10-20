import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run durable Meta event retries and lease recovery every minute.
crons.interval("meta-webhook-sweep", { minutes: 1 }, internal.meta.sweepWebhookEvents, {});

export default crons;
