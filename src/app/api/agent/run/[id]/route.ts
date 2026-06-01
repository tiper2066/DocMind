import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { agentRuns, agents, agentEvents, approvals } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";

export const runtime = "nodejs";

// GET /api/agent/run/[id] — run 상세 (run + phase events + approvals). [id] = runId.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const [run] = await db
    .select({
      run: agentRuns,
      workspaceId: agents.workspaceId,
    })
    .from(agentRuns)
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .where(eq(agentRuns.id, id))
    .limit(1);

  if (!run || run.workspaceId !== ctx.workspaceId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const events = await db
    .select({
      id: agentEvents.id,
      ts: agentEvents.ts,
      phase: agentEvents.phase,
      type: agentEvents.type,
      payload: agentEvents.payloadJson,
    })
    .from(agentEvents)
    .where(eq(agentEvents.runId, id))
    .orderBy(asc(agentEvents.ts));

  const runApprovals = await db
    .select()
    .from(approvals)
    .where(eq(approvals.runId, id));

  return NextResponse.json({
    run: run.run,
    events,
    approvals: runApprovals,
  });
}
