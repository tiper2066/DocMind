import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { getWorkspaceContext } from "@/lib/rbac";
import { canToggleTrend } from "@/lib/trend-admin";

export const runtime = "nodejs";

const Body = z.object({
  enabled: z.boolean(),
});

// "최신 지식 및 동향 검색" 스위치 — agents(kind='trend') 행의 auto_run 으로 영속화.
// ON 전환 시 즉시 1회 스캔을 발화한다 (데모: cron 시각을 기다리지 않음).
export async function PATCH(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // UI 우회(직접 API 호출) 차단 — 화이트리스트 미포함 사용자는 403.
  if (!(await canToggleTrend(ctx.userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { enabled } = parsed.data;

  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(
      and(eq(agents.workspaceId, ctx.workspaceId), eq(agents.kind, "trend")),
    )
    .limit(1);

  if (existing) {
    await db
      .update(agents)
      .set({ autoRun: enabled })
      .where(eq(agents.id, existing.id));
  } else {
    await db.insert(agents).values({
      workspaceId: ctx.workspaceId,
      kind: "trend",
      status: "active",
      autoRun: enabled,
      configJson: {},
    });
  }

  if (enabled) {
    await inngest.send({
      name: "agent/trend.scan.requested",
      data: { workspaceId: ctx.workspaceId },
    });
  }

  return NextResponse.json({ ok: true, enabled });
}
