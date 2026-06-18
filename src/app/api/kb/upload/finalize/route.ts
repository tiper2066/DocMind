import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { sources } from "@/db/schema";
import { dispatch } from "@/inngest/client";
import { getWorkspaceContext } from "@/lib/rbac";

export const runtime = "nodejs";

const Body = z.object({
  key: z.string().min(1).max(400),
  filename: z.string().min(1).max(200).optional(),
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

  const { key, filename } = parsed.data;
  if (!key.startsWith(`${ctx.workspaceId}/`)) {
    return NextResponse.json({ error: "key_prefix_mismatch" }, { status: 403 });
  }

  const titleHint = filename ?? key.split("/").pop() ?? "(file)";

  const [row] = await db
    .insert(sources)
    .values({
      workspaceId: ctx.workspaceId,
      kind: "file",
      fileKey: key,
      title: titleHint,
      status: "crawling",
    })
    .returning({ id: sources.id });

  await dispatch({
    name: "source/crawl.requested",
    data: { workspaceId: ctx.workspaceId, sourceId: row.id },
  });

  return NextResponse.json({ sourceId: row.id }, { status: 202 });
}
