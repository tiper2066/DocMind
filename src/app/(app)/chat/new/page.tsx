import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { documents, interviewSessions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { DOC_TYPE_LABELS } from "@/lib/interview/machine";

export const dynamic = "force-dynamic";

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const { type } = await searchParams;
  const docType = type && DOC_TYPE_LABELS[type] ? type : "sales";

  const [doc] = await db
    .insert(documents)
    .values({
      workspaceId: ctx.workspaceId,
      type: docType,
      title: `${DOC_TYPE_LABELS[docType]} 초안`,
      status: "draft",
      createdBy: ctx.userId,
    })
    .returning({ id: documents.id });

  await db.insert(interviewSessions).values({
    documentId: doc.id,
    currentStep: "reader",
    answersJson: {},
  });

  redirect(`/chat/${doc.id}`);
}
