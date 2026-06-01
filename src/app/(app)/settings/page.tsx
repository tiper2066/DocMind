import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { agents, brandTemplates, workspaceMembers, users } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { ensureMonitorAgent } from "@/lib/agent/events";
import { getPolicy, getNotifyChannel } from "@/lib/agent/policy";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const agentId = await ensureMonitorAgent(ctx.workspaceId);
  const [agent] = await db
    .select({ autoRun: agents.autoRun, configJson: agents.configJson })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  const publish = getPolicy(agent ?? { configJson: {} }).publish ?? "manual";
  const notifyChannel = getNotifyChannel(agent ?? { configJson: {} }) ?? "";
  const autoRun = agent?.autoRun ?? true;

  const templates = await db
    .select({ id: brandTemplates.id, name: brandTemplates.name })
    .from(brandTemplates)
    .where(eq(brandTemplates.workspaceId, ctx.workspaceId));

  const members = await db
    .select({ email: users.email })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, ctx.workspaceId));

  const slackConfigured =
    !!process.env.SLACK_BOT_TOKEN &&
    !process.env.SLACK_BOT_TOKEN.startsWith("xoxb-0000");
  const emailConfigured =
    !!process.env.RESEND_API_KEY &&
    !process.env.RESEND_API_KEY.startsWith("re_xxxx");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-heading text-heading-3 text-ink">설정</h1>
      <p className="mt-1 mb-6 text-body-sm text-steel">
        에이전트 정책, 알림 채널, 브랜드 템플릿을 관리합니다.
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          에이전트 정책 & 알림
        </h2>
        <SettingsForm initial={{ autoRun, publish, notifyChannel }} />
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant={slackConfigured ? "secondary" : "outline"}>
            Slack {slackConfigured ? "연결됨" : "미설정"}
          </Badge>
          <Badge variant={emailConfigured ? "secondary" : "outline"}>
            Email {emailConfigured ? "연결됨" : "미설정"}
          </Badge>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          이메일 수신자 (워크스페이스 멤버)
        </h2>
        <div className="rounded-lg border p-4 text-sm">
          {members.length === 0 ? (
            <span className="text-muted-foreground">멤버 없음</span>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.email} className="text-muted-foreground">
                  {m.email}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          브랜드 템플릿
        </h2>
        <div className="rounded-lg border p-4">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              등록된 브랜드 템플릿이 없습니다. PPT 디자인은 현재 코퍼레이트 토큰(
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                tokens.ppt.json
              </code>
              )을 사용합니다. 웹 UI 토큰은 Phase 8에서 적용됩니다.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {templates.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
