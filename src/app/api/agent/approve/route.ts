import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  approvals,
  agentRuns,
  agents,
  documents,
  documentVersions,
  notifications,
  learningPatterns,
  auditLogs,
  users,
} from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { appendEvent } from "@/lib/agent/events";
import { dispatchApprovalNotifications } from "@/lib/notify";

export const runtime = "nodejs";

const Body = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { approvalId, decision } = parsed.data;

  // 승인은 워크스페이스 격리: approval → run → agent → workspace 로 검증.
  const [row] = await db
    .select({
      approval: approvals,
      agentWorkspace: agents.workspaceId,
    })
    .from(approvals)
    .innerJoin(agentRuns, eq(agentRuns.id, approvals.runId))
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .where(eq(approvals.id, approvalId))
    .limit(1);

  if (!row || row.agentWorkspace !== ctx.workspaceId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.approval.decision) {
    return NextResponse.json(
      { error: "already_decided", decision: row.approval.decision },
      { status: 409 },
    );
  }

  const payload = (row.approval.payload ?? {}) as {
    versionId?: string;
    version?: number;
    changeNote?: string;
  };
  const runId = row.approval.runId;
  const documentId = row.approval.documentId;

  await db
    .update(approvals)
    .set({ decision, decidedBy: ctx.userId, decidedAt: new Date() })
    .where(eq(approvals.id, approvalId));

  let notify: { slack: string; email: string } | null = null;

  if (decision === "approve") {
    if (payload.versionId) {
      await db
        .update(documentVersions)
        .set({ status: "published" })
        .where(eq(documentVersions.id, payload.versionId));
    }
    let docTitle = "문서";
    if (documentId) {
      const [d] = await db
        .update(documents)
        .set({ status: "ready", updatedAt: new Date() })
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.workspaceId, ctx.workspaceId),
          ),
        )
        .returning({ title: documents.title });
      if (d?.title) docTitle = d.title;
    }
    await db
      .update(learningPatterns)
      .set({ outcome: "approved" })
      .where(eq(learningPatterns.runId, runId));

    const [actor] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    // 발송은 승인 후에만 (기획서 §5.5). 실패해도 승인 자체는 성공 처리하고 fallback 신호만 반환.
    notify = await dispatchApprovalNotifications({
      runId,
      workspaceId: ctx.workspaceId,
      documentTitle: docTitle,
      version: payload.version ?? 0,
      changeNote: payload.changeNote ?? null,
      approvalId,
      decidedByEmail: actor?.email ?? null,
    });
  } else {
    if (payload.versionId) {
      await db
        .update(documentVersions)
        .set({ status: "rejected" })
        .where(eq(documentVersions.id, payload.versionId));
    }
    await db
      .update(notifications)
      .set({ status: "skipped" })
      .where(
        and(
          eq(notifications.relatedRunId, runId),
          eq(notifications.status, "pending"),
        ),
      );
    await db
      .update(learningPatterns)
      .set({ outcome: "rejected" })
      .where(eq(learningPatterns.runId, runId));
  }

  await appendEvent(runId, "act", "approval.decided", {
    approvalId,
    decision,
    versionId: payload.versionId,
    version: payload.version,
  });

  await db.insert(auditLogs).values({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: `approval.${decision}`,
    target: approvalId,
  });

  return NextResponse.json({
    ok: true,
    approvalId,
    decision,
    versionId: payload.versionId ?? null,
    published: decision === "approve",
    notify,
  });
}
