import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { crawlSource } from "@/inngest/functions";
import { agentFunctions } from "@/inngest/agent";
import { trendScan } from "@/inngest/trend";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [crawlSource, ...agentFunctions, trendScan],
});
