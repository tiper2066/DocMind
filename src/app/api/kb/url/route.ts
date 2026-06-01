import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { sources } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { getWorkspaceContext } from "@/lib/rbac";

export const runtime = "nodejs";

const Body = z.object({
  url: z.string().url().max(2048),
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

  const url = new URL(parsed.data.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported_protocol" }, { status: 400 });
  }

  const [row] = await db
    .insert(sources)
    .values({
      workspaceId: ctx.workspaceId,
      kind: "url",
      url: url.toString(),
      status: "crawling",
    })
    .returning({ id: sources.id });

  await inngest.send({
    name: "source/crawl.requested",
    data: { workspaceId: ctx.workspaceId, sourceId: row.id },
  });

  return NextResponse.json({ sourceId: row.id }, { status: 202 });
}
