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
import { canUseApprovalActions } from "@/lib/trend-admin";
import { appendEvent, endRun } from "@/lib/agent/events";
import { dispatchApprovalNotifications } from "@/lib/notify";
import { dispatch } from "@/inngest/client";

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
  // 데모 보호: 화이트리스트 외 사용자의 승인/거부 차단 (UI 우회 포함).
  if (!(await canUseApprovalActions(ctx.userId))) {
    return NextResponse.json(
      { error: "forbidden", message: "데모 버전이므로 발표자만 사용 가능합니다." },
      { status: 403 },
    );
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

  // ── kind=regenerate: 감지 단계에서 멈춘 루프의 재개/중단 관문 ──
  // 승인 → source.changed 발화로 인식→판단→행동→학습 재개 (행동에서 자동 발행+알림).
  // 거부 → run 종료, 문서 갱신 없음.
  if (row.approval.kind === "regenerate") {
    const rp = (row.approval.payload ?? {}) as {
      agentId?: string;
      sourceId?: string;
      previousHash?: string | null;
      nextHash?: string;
      changeRatio?: number;
      newText?: string;
      forced?: boolean;
    };

    await appendEvent(runId, "detect", "approval.decided", {
      approvalId,
      decision,
      sourceId: rp.sourceId,
    });
    await db.insert(auditLogs).values({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: `approval.${decision}`,
      target: approvalId,
    });

    if (decision === "approve") {
      await dispatch({
        name: "source.changed",
        data: {
          workspaceId: ctx.workspaceId,
          agentId: rp.agentId,
          runId,
          sourceId: rp.sourceId,
          previousHash: rp.previousHash ?? null,
          nextHash: rp.nextHash ?? "",
          changeRatio: rp.changeRatio ?? 1,
          newText: rp.newText ?? "",
          forced: rp.forced ?? false,
          approvedPublish: true,
        },
      });
      return NextResponse.json({
        ok: true,
        approvalId,
        decision,
        resumed: true,
      });
    }

    await endRun(runId, "succeeded", "승인 거부 — 문서 갱신 중단");
    return NextResponse.json({ ok: true, approvalId, decision, resumed: false });
  }

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
