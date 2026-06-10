import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, documentVersions, interviewSessions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { ANSWERABLE_STEPS, type Answers } from "@/lib/interview/machine";
import { generateDeck, normalizeDocumentSources } from "@/lib/ppt/generate";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  documentId: z.string().uuid(),
  securityLevel: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ])
    .default(1),
});

export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, parsed.data.documentId),
        eq(documents.workspaceId, ctx.workspaceId),
      ),
    )
    .limit(1);
  if (!doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.documentId, doc.id))
    .limit(1);
  if (!session) {
    return NextResponse.json({ error: "no_session" }, { status: 404 });
  }

  const answers = (session.answersJson ?? {}) as Answers;
  const missing = ANSWERABLE_STEPS.filter((s) => !answers[s]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "incomplete_answers", missing },
      { status: 400 },
    );
  }

  const lengthPages = parseLengthPages(answers.length ?? "") ?? 10;

  await db
    .update(documents)
    .set({
      reader: answers.reader ?? null,
      cta: answers.cta ?? null,
      objection: answers.objection ?? null,
      lengthPages,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  await db
    .update(interviewSessions)
    .set({ currentStep: "generate", updatedAt: new Date() })
    .where(eq(interviewSessions.documentId, doc.id));

  const deck = await generateDeck({
    workspaceId: ctx.workspaceId,
    documentId: doc.id,
    documentType: doc.type,
    documentTitle: doc.title,
    answers: {
      reader: answers.reader!,
      cta: answers.cta!,
      objection: answers.objection!,
      keyMessage: answers.keyMessage!,
      length: answers.length!,
    },
    lengthPages,
    securityLevel: parsed.data.securityLevel,
    forcedTitle: doc.titleManual ? doc.title : undefined,
  });

  const [latest] = await db
    .select({ version: documentVersions.version })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, doc.id))
    .orderBy(desc(documentVersions.version))
    .limit(1);
  const nextVersion = (latest?.version ?? 0) + 1;

  const [row] = await db
    .insert(documentVersions)
    .values({
      documentId: doc.id,
      version: nextVersion,
      status: "published",
      slidesJson: deck as unknown as object,
      createdBy: ctx.userId,
      changeNote: nextVersion === 1 ? "initial generation" : "regenerate",
    })
    .returning({ id: documentVersions.id, version: documentVersions.version });

  await normalizeDocumentSources(doc.id, deck);

  // 카드 제목을 deck 대표 제목(=PPT 표지 제목)과 동기화. 단 사용자가 직접 정한
  // 제목(titleManual)이면 덮어쓰지 않는다(재생성 휘발 방지).
  const coverTitle = deck.meta.title?.trim();
  const syncTitle = !doc.titleManual && coverTitle;

  await db
    .update(documents)
    .set({
      status: "ready",
      ...(syncTitle ? { title: coverTitle } : {}),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  return NextResponse.json({
    documentId: doc.id,
    versionId: row.id,
    version: row.version,
    slideCount: deck.slides.length,
  });
}

function parseLengthPages(s: string): number | null {
  const m = /(\d+)/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 200) return null;
  return n;
}
