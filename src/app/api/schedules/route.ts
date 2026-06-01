import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { schedules } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { ScheduleTemplate } from "@/lib/schedule";
import { isValidCron } from "@/lib/cron";

export const runtime = "nodejs";

const Body = z.object({
  cron: z.string().min(1).max(120),
  template: ScheduleTemplate,
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
  if (!isValidCron(parsed.data.cron)) {
    return NextResponse.json({ error: "invalid_cron" }, { status: 400 });
  }

  const [row] = await db
    .insert(schedules)
    .values({
      workspaceId: ctx.workspaceId,
      cron: parsed.data.cron.trim(),
      documentTemplateJson: parsed.data.template,
      enabled: true,
    })
    .returning({ id: schedules.id });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
