import { notFound, redirect } from "next/navigation";
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
import { ChatView } from "@/components/chat/ChatView";
import { FolderAssigner } from "@/components/chat/FolderAssigner";
import type { InitialChatState } from "@/lib/interview/store";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const { documentId } = await params;
  const { folder } = await searchParams;

  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.workspaceId, ctx.workspaceId),
      ),
    )
    .limit(1);
  if (!doc) notFound();

  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.documentId, doc.id))
    .limit(1);
  if (!session) notFound();

  const answers = (session.answersJson ?? {}) as Answers;
  const currentStep = session.currentStep as Step;

  let initialQuestion: InitialChatState["initialQuestion"] = null;
  if (isAnswerable(currentStep)) {
    const q = await generateQuestion({
      workspaceId: ctx.workspaceId,
      documentType: doc.type,
      step: currentStep,
      answers,
    });
    initialQuestion = {
      aiMessage: q.aiMessage,
      quickReplies: q.quickReplies,
      insight: q.insight,
      matches: (q.matches ?? []).map((m) => ({
        sourceId: m.sourceId,
        title: m.title,
        text: m.text,
        sim: m.sim,
      })),
    };
  }

  const initial: InitialChatState = {
    documentId: doc.id,
    documentType: doc.type,
    currentStep,
    answers,
    initialQuestion,
  };

  return (
    <>
      {folder && <FolderAssigner documentId={doc.id} folder={folder} />}
      <ChatView initial={initial} />
    </>
  );
}
