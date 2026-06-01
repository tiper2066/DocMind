import { and, asc, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db/client";
import { agentEvents, agentRuns, agents } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { formatSSE, SSE_HEADERS, type AgentEventMessage } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const POLL_MS = 1000;
const HEARTBEAT_MS = 15000;
const BACKLOG = 20;

type Row = {
  id: string;
  runId: string;
  phase: string;
  type: string;
  ts: Date;
  payload: unknown;
};

function toMessage(r: Row): AgentEventMessage {
  return {
    id: r.id,
    runId: r.runId,
    phase: r.phase,
    type: r.type,
    ts: r.ts.toISOString(),
    payload: r.payload,
  };
}

async function fetchAfter(
  workspaceId: string,
  afterTs: Date | null,
): Promise<Row[]> {
  const rows = await db
    .select({
      id: agentEvents.id,
      runId: agentEvents.runId,
      phase: agentEvents.phase,
      type: agentEvents.type,
      ts: agentEvents.ts,
      payload: agentEvents.payloadJson,
    })
    .from(agentEvents)
    .innerJoin(agentRuns, eq(agentRuns.id, agentEvents.runId))
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .where(
      afterTs
        ? and(eq(agents.workspaceId, workspaceId), gt(agentEvents.ts, afterTs))
        : eq(agents.workspaceId, workspaceId),
    )
    .orderBy(asc(agentEvents.ts));
  return rows;
}

async function fetchBacklog(workspaceId: string): Promise<Row[]> {
  const rows = await db
    .select({
      id: agentEvents.id,
      runId: agentEvents.runId,
      phase: agentEvents.phase,
      type: agentEvents.type,
      ts: agentEvents.ts,
      payload: agentEvents.payloadJson,
    })
    .from(agentEvents)
    .innerJoin(agentRuns, eq(agentRuns.id, agentEvents.runId))
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .where(eq(agents.workspaceId, workspaceId))
    .orderBy(desc(agentEvents.ts))
    .limit(BACKLOG);
  return rows.reverse();
}

// 커서(eventId) → 해당 이벤트 ts. 없으면 null(=백로그부터).
async function resolveCursor(eventId: string | null): Promise<Date | null> {
  if (!eventId) return null;
  const [row] = await db
    .select({ ts: agentEvents.ts })
    .from(agentEvents)
    .where(eq(agentEvents.id, eventId))
    .limit(1);
  return row?.ts ?? null;
}

export async function GET(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response("unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const cursorId =
    url.searchParams.get("since") ?? req.headers.get("last-event-id");
  const cursorTs = await resolveCursor(cursorId);

  const encoder = new TextEncoder();
  const workspaceId = ctx.workspaceId;

  let lastTs: Date | null = cursorTs;
  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let beatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          closed = true;
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (beatTimer) clearInterval(beatTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);

      // 재구독 지연 힌트
      safeEnqueue("retry: 3000\n\n");

      // 초기 적재: 커서가 있으면 그 이후 따라잡기, 없으면 최근 백로그.
      const initial = cursorTs
        ? await fetchAfter(workspaceId, cursorTs)
        : await fetchBacklog(workspaceId);
      for (const r of initial) {
        safeEnqueue(formatSSE({ id: r.id, data: toMessage(r) }));
        lastTs = r.ts;
      }

      pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const rows = await fetchAfter(workspaceId, lastTs);
          for (const r of rows) {
            safeEnqueue(formatSSE({ id: r.id, data: toMessage(r) }));
            lastTs = r.ts;
          }
        } catch {
          /* transient DB error: keep connection, retry next tick */
        }
      }, POLL_MS);

      beatTimer = setInterval(() => safeEnqueue(": ping\n\n"), HEARTBEAT_MS);
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (beatTimer) clearInterval(beatTimer);
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
