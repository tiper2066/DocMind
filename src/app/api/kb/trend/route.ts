import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { getWorkspaceContext } from "@/lib/rbac";
import {
  canManageTrendFeature,
  canToggleTrend,
  trendFeatureHidden,
} from "@/lib/trend-admin";

export const runtime = "nodejs";

const Body = z
  .object({
    enabled: z.boolean().optional(),
    featureHidden: z.boolean().optional(),
  })
  .refine((b) => b.enabled !== undefined || b.featureHidden !== undefined, {
    message: "enabled 또는 featureHidden 중 하나는 필요합니다",
  });

// "최신 지식 및 동향 검색" 스위치 — agents(kind='trend') 행의 auto_run 으로 영속화.
// ON 전환 시 즉시 1회 스캔을 발화한다 (데모: cron 시각을 기다리지 않음).
// featureHidden: 기능 전체 숨김 + 강제 OFF — 하드코딩 관리자만 변경 가능.
export async function PATCH(req: Request) {
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
  const { enabled, featureHidden } = parsed.data;

  // UI 우회(직접 API 호출) 차단.
  if (enabled !== undefined && !(await canToggleTrend(ctx.userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (
    featureHidden !== undefined &&
    !(await canManageTrendFeature(ctx.userId))
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [existing] = await db
    .select({ id: agents.id, configJson: agents.configJson })
    .from(agents)
    .where(
      and(eq(agents.workspaceId, ctx.workspaceId), eq(agents.kind, "trend")),
    )
    .limit(1);

  const hiddenNow = trendFeatureHidden(existing?.configJson);
  // 숨김 상태에서는 스위치 ON 불가 — 스위치가 화면에 없으므로 직접 호출 방어.
  if (enabled === true && hiddenNow && featureHidden !== false) {
    return NextResponse.json({ error: "feature_hidden" }, { status: 409 });
  }

  const nextHidden = featureHidden ?? hiddenNow;
  // 숨김 = 강제 OFF. enabled 미지정이면 기존 auto_run 유지(단 숨김 전환 시 false).
  const nextAutoRun = nextHidden ? false : enabled;

  if (existing) {
    await db
      .update(agents)
      .set({
        ...(nextAutoRun !== undefined ? { autoRun: nextAutoRun } : {}),
        ...(featureHidden !== undefined
          ? {
              configJson: {
                ...(existing.configJson as Record<string, unknown>),
                featureHidden,
              },
            }
          : {}),
      })
      .where(eq(agents.id, existing.id));
  } else {
    await db.insert(agents).values({
      workspaceId: ctx.workspaceId,
      kind: "trend",
      status: "active",
      autoRun: nextAutoRun ?? false,
      configJson: featureHidden !== undefined ? { featureHidden } : {},
    });
  }

  if (enabled === true && !nextHidden) {
    await inngest.send({
      name: "agent/trend.scan.requested",
      data: { workspaceId: ctx.workspaceId },
    });
  }

  return NextResponse.json({
    ok: true,
    enabled: nextAutoRun ?? false,
    featureHidden: nextHidden,
  });
}
