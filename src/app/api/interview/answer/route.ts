import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, interviewSessions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { generateQuestion } from "@/lib/interview/service";
import {
  ANSWERABLE_STEPS,
  isAnswerable,
  isLastAnswerable,
  nextStep,
  type AnswerableStep,
  type Answers,
  type Step,
} from "@/lib/interview/machine";

export const runtime = "nodejs";

const Body = z.object({
  documentId: z.string().uuid(),
  step: z.enum(ANSWERABLE_STEPS as [string, ...string[]]),
  answer: z.string().min(1).max(500),
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
  const { documentId, step, answer } = parsed.data;

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

  if (session.currentStep !== step) {
    return NextResponse.json(
      {
        error: "step_mismatch",
        expected: session.currentStep,
        got: step,
      },
      { status: 409 },
    );
  }

  const prevAnswers = (session.answersJson ?? {}) as Answers;
  const nextAnswers: Answers = {
    ...prevAnswers,
    [step as AnswerableStep]: answer,
  };

  const advancedStep = isLastAnswerable(step as Step)
    ? "generate"
    : (nextStep(step as Step) ?? "generate");

  await db
    .update(interviewSessions)
    .set({
      answersJson: nextAnswers,
      currentStep: advancedStep,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.documentId, doc.id));

  if (!isAnswerable(advancedStep)) {
    return NextResponse.json({
      step: advancedStep,
      answers: nextAnswers,
      done: true,
    });
  }

  const q = await generateQuestion({
    workspaceId: ctx.workspaceId,
    documentType: doc.type,
    step: advancedStep as AnswerableStep,
    answers: nextAnswers,
  });

  return NextResponse.json({
    step: advancedStep,
    answers: nextAnswers,
    question: q,
    done: false,
  });
}
