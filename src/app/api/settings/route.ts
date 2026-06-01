import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { ensureMonitorAgent } from "@/lib/agent/events";

export const runtime = "nodejs";

const Body = z.object({
  autoRun: z.boolean().optional(),
  publish: z.enum(["manual", "auto"]).optional(),
  notifyChannel: z.string().max(120).optional(),
});

// 워크스페이스 에이전트 정책 + 알림 채널 갱신 (monitor 에이전트 config_json 에 저장).
export async function PATCH(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const agentId = await ensureMonitorAgent(ctx.workspaceId);
  const [agent] = await db
    .select({ autoRun: agents.autoRun, configJson: agents.configJson })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  const cfg = (agent?.configJson ?? {}) as {
    policy?: { publish?: string };
    notifyChannel?: string;
  };
  const nextCfg = {
    ...cfg,
    policy: {
      ...(cfg.policy ?? {}),
      ...(parsed.data.publish ? { publish: parsed.data.publish } : {}),
    },
    ...(parsed.data.notifyChannel !== undefined
      ? { notifyChannel: parsed.data.notifyChannel.trim() }
      : {}),
  };

  await db
    .update(agents)
    .set({
      configJson: nextCfg,
      ...(parsed.data.autoRun !== undefined
        ? { autoRun: parsed.data.autoRun }
        : {}),
    })
    .where(eq(agents.id, agentId));

  return NextResponse.json({ ok: true });
}
