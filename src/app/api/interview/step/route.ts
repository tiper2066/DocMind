import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, interviewSessions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { generateQuestion } from "@/lib/interview/service";
import {
  ANSWERABLE_STEPS,
  STEPS,
  type AnswerableStep,
  type Answers,
  type Step,
} from "@/lib/interview/machine";

export const runtime = "nodejs";

// 인터뷰 도중 이전(또는 이미 방문한) 단계로 되돌아가기. 답변은 보존하고 currentStep 만 옮긴다.
const Body = z.object({
  documentId: z.string().uuid(),
  step: z.enum(ANSWERABLE_STEPS as [string, ...string[]]),
});

export async function PATCH(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { documentId, step } = parsed.data;
  const target = step as AnswerableStep;

  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.workspaceId, ctx.workspaceId)),
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

  // 허용 규칙: 이미 답변한 단계이거나, 현재 단계보다 앞선 단계만(미래 미답변 단계로 건너뛰기 차단).
  const reachable =
    answers[target] != null ||
    STEPS.indexOf(target) <= STEPS.indexOf(session.currentStep as Step);
  if (!reachable) {
    return NextResponse.json({ error: "step_not_reachable" }, { status: 409 });
  }

  await db
    .update(interviewSessions)
    .set({ currentStep: target, updatedAt: new Date() })
    .where(eq(interviewSessions.documentId, doc.id));

  const q = await generateQuestion({
    workspaceId: ctx.workspaceId,
    documentType: doc.type,
    step: target,
    answers,
  });

  return NextResponse.json({
    step: target,
    answers,
    question: q,
    previousAnswer: answers[target] ?? "",
    done: false,
  });
}
