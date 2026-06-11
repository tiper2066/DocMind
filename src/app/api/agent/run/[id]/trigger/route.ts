import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { getWorkspaceContext } from "@/lib/rbac";
import { canUseApprovalActions } from "@/lib/trend-admin";

export const runtime = "nodejs";

// POST /api/agent/run/[id]/trigger — 개발자 모드 "지금 감지". [id] = agentId.
// 해당 에이전트의 워크스페이스에 대해 즉시 detect 실행 (옵션 sourceId 로 단일 소스).
const Body = z.object({ sourceId: z.string().uuid().optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // 데모 보호: 화이트리스트 외 사용자의 감지 트리거 차단.
  if (!(await canUseApprovalActions(ctx.userId))) {
    return NextResponse.json(
      { error: "forbidden", message: "데모 버전이므로 발표자만 사용 가능합니다." },
      { status: 403 },
    );
  }
  const { id: agentId } = await params;

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(
      and(eq(agents.id, agentId), eq(agents.workspaceId, ctx.workspaceId)),
    )
    .limit(1);
  if (!agent) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json ?? {});
  const sourceId = parsed.success ? parsed.data.sourceId : undefined;

  await inngest.send({
    name: "agent/detect.requested",
    data: { workspaceId: ctx.workspaceId, agentId, sourceId },
  });

  return NextResponse.json({ ok: true, triggered: true }, { status: 202 });
}
