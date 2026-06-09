import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { ensureMonitorAgent } from "@/lib/agent/events";
import { getPolicy, getNotifyChannel } from "@/lib/agent/policy";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { TemplateCard } from "@/components/settings/TemplateCard";
import { ModeCard } from "@/components/settings/ModeCard";

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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-heading text-heading-3 text-ink">설정</h1>
      <p className="mt-1 mb-8 text-body-sm text-steel">
        에이전트 정책, 알림, 문서 템플릿을 관리합니다.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 lg:h-full">
          <SettingsForm initial={{ autoRun, publish, notifyChannel }} />
        </div>
        <div className="space-y-6">
          <TemplateCard />
          <ModeCard />
        </div>
      </div>
    </main>
  );
}
