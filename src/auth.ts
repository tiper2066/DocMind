import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db } from "./db/client";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  workspaces,
  workspaceMembers,
} from "./db/schema";

const SEED_WORKSPACE = "Penta Security";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      const [ws] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.name, SEED_WORKSPACE))
        .limit(1);
      if (!ws) return;
      await db
        .insert(workspaceMembers)
        .values({ workspaceId: ws.id, userId: user.id, role: "owner" })
        .onConflictDoNothing();
    },
  },
});
