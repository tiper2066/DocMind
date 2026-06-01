import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { workspaceMembers } from "@/db/schema";

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: string;
};

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const rows = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);
  const m = rows[0];
  if (!m) return null;

  return { userId, workspaceId: m.workspaceId, role: m.role };
}
