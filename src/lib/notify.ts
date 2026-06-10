import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { notifications, workspaceMembers, users } from "@/db/schema";
import { appendEvent } from "@/lib/agent/events";
import {
  sendSlack,
  buildPublishBlocks,
  resolveChannel,
  type SlackSendResult,
} from "@/lib/slack";
import { sendPublishEmail, type EmailSendResult } from "@/lib/email";

export function appBaseUrl(): string {
  // `||`: 빈 문자열로 설정된 env 도 fallback 처리 (Slack 버튼 URL 은 절대 경로 필수)
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

export type DispatchInput = {
  runId: string;
  workspaceId: string;
  documentTitle: string;
  version: number;
  changeNote?: string | null;
  approvalId: string;
  decidedByEmail?: string | null;
};

export type DispatchResult = {
  slack: SlackSendResult["status"];
  email: EmailSendResult["status"];
};

// 승인 시점에 호출. Slack(채널) + Email(워크스페이스 멤버) 발송 후 notifications 이력 갱신.
// 발송은 항상 승인 후 (기획서 §5.5) — 자율 outbound 금지.
export async function dispatchApprovalNotifications(
  input: DispatchInput,
): Promise<DispatchResult> {
  const approvalUrl = `${appBaseUrl()}/agent?approval=${input.approvalId}`;

  // ── Slack ──────────────────────────────────────────────
  const [slackRow] = await db
    .select({ id: notifications.id, target: notifications.target })
    .from(notifications)
    .where(
      and(
        eq(notifications.relatedRunId, input.runId),
        eq(notifications.channel, "slack"),
      ),
    )
    .limit(1);

  const channel = resolveChannel(slackRow?.target ?? null);
  const slackRes = await sendSlack({
    channel,
    text: `${input.documentTitle} v${input.version} 발행됨`,
    blocks: buildPublishBlocks({
      documentTitle: input.documentTitle,
      version: input.version,
      changeNote: input.changeNote,
      approvalUrl,
      decidedByEmail: input.decidedByEmail,
    }),
  });

  const slackStatus =
    slackRes.status === "sent"
      ? "sent"
      : slackRes.status === "skipped"
        ? "skipped"
        : "failed";

  const slackPayload = {
    approvalId: input.approvalId,
    ...(slackRes.status === "sent" ? { ts: slackRes.ts } : {}),
    ...(slackRes.status === "failed" ? { error: slackRes.error } : {}),
    ...(slackRes.status === "skipped" ? { reason: slackRes.reason } : {}),
  };

  if (slackRow) {
    await db
      .update(notifications)
      .set({ status: slackStatus, payload: slackPayload })
      .where(eq(notifications.id, slackRow.id));
  } else {
    await db.insert(notifications).values({
      workspaceId: input.workspaceId,
      channel: "slack",
      target: channel ?? "#docmind-demo",
      status: slackStatus,
      relatedRunId: input.runId,
      payload: slackPayload,
    });
  }

  if (slackRes.status === "failed") {
    await appendEvent(input.runId, "act", "notification.failed", {
      channel: "slack",
      error: slackRes.error,
    });
  }

  // ── Email ──────────────────────────────────────────────
  const members = await db
    .select({ email: users.email })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, input.workspaceId));
  const recipients = members.map((m) => m.email).filter(Boolean);

  const emailRes = await sendPublishEmail({
    to: recipients,
    documentTitle: input.documentTitle,
    version: input.version,
    changeNote: input.changeNote,
    url: approvalUrl,
  });

  const emailStatus =
    emailRes.status === "sent"
      ? "sent"
      : emailRes.status === "skipped"
        ? "skipped"
        : "failed";

  await db.insert(notifications).values({
    workspaceId: input.workspaceId,
    channel: "email",
    target: recipients.join(", ") || "(none)",
    status: emailStatus,
    relatedRunId: input.runId,
    payload: {
      approvalId: input.approvalId,
      ...(emailRes.status === "sent" ? { id: emailRes.id } : {}),
      ...(emailRes.status === "failed" ? { error: emailRes.error } : {}),
      ...(emailRes.status === "skipped" ? { reason: emailRes.reason } : {}),
    },
  });

  if (emailRes.status === "failed") {
    await appendEvent(input.runId, "act", "notification.failed", {
      channel: "email",
      error: emailRes.error,
    });
  }

  return { slack: slackStatus, email: emailStatus };
}
