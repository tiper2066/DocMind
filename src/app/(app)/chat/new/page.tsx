import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { documents, interviewSessions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { DOC_TYPE_LABELS } from "@/lib/interview/machine";

export const dynamic = "force-dynamic";

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; folder?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const { type, folder } = await searchParams;
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

  // folder(세션 문서함)는 클라 스토어에서 문서↔문서함 매핑 기록에 쓰인다(데모 한정, DB 미persist).
  redirect(
    folder ? `/chat/${doc.id}?folder=${encodeURIComponent(folder)}` : `/chat/${doc.id}`,
  );
}
