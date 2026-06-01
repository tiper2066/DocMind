import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { schedules } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";

export const runtime = "nodejs";

const PatchBody = z.object({ enabled: z.boolean() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const res = await db
    .update(schedules)
    .set({ enabled: parsed.data.enabled })
    .where(
      and(eq(schedules.id, id), eq(schedules.workspaceId, ctx.workspaceId)),
    )
    .returning({ id: schedules.id });

  if (res.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const res = await db
    .delete(schedules)
    .where(
      and(eq(schedules.id, id), eq(schedules.workspaceId, ctx.workspaceId)),
    )
    .returning({ id: schedules.id });

  if (res.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
