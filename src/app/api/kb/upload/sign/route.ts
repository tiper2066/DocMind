import { NextResponse } from "next/server";
import { z } from "zod";
import { createSourceUploadUrl } from "@/lib/storage";
import { getWorkspaceContext } from "@/lib/rbac";

export const runtime = "nodejs";

const ALLOWED_EXT = new Set(["pdf", "docx", "xlsx", "pptx"]);
const MAX_FILENAME = 200;

const Body = z.object({
  filename: z.string().min(1).max(MAX_FILENAME),
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

  const ext =
    parsed.data.filename.includes(".")
      ? parsed.data.filename.split(".").pop()!.toLowerCase()
      : "";
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: "unsupported_extension", ext },
      { status: 400 },
    );
  }

  const sign = await createSourceUploadUrl(ctx.workspaceId, parsed.data.filename);
  return NextResponse.json(sign);
}
