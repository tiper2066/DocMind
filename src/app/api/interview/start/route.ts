import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, interviewSessions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { generateQuestion } from "@/lib/interview/service";
import {
  isAnswerable,
  type Answers,
  type Step,
} from "@/lib/interview/machine";

export const runtime = "nodejs";

const Body = z.object({ documentId: z.string().uuid() });

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
    return NextResponse.json(
      { error: "no_session_for_document" },
      { status: 404 },
    );
  }

  const answers = (session.answersJson ?? {}) as Answers;
  const currentStep = session.currentStep as Step;

  if (!isAnswerable(currentStep)) {
    return NextResponse.json({
      documentId: doc.id,
      documentType: doc.type,
      currentStep,
      answers,
      done: true,
    });
  }

  const q = await generateQuestion({
    workspaceId: ctx.workspaceId,
    documentType: doc.type,
    step: currentStep,
    answers,
  });

  return NextResponse.json({
    documentId: doc.id,
    documentType: doc.type,
    currentStep,
    answers,
    question: q,
  });
}
