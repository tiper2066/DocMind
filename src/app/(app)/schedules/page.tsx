import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { schedules } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { DOC_TYPE_LABELS } from "@/lib/interview/machine";
import { Badge } from "@/components/ui/badge";
import { ScheduleForm } from "@/components/schedules/ScheduleForm";
import { ScheduleActions } from "@/components/schedules/ScheduleActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Template = {
  type?: string;
  title?: string;
  reader?: string;
  length?: string;
};

export default async function SchedulesPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const rows = await db
    .select({
      id: schedules.id,
      cron: schedules.cron,
      enabled: schedules.enabled,
      template: schedules.documentTemplateJson,
      createdAt: schedules.createdAt,
    })
    .from(schedules)
    .where(eq(schedules.workspaceId, ctx.workspaceId))
    .orderBy(desc(schedules.createdAt));

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-heading text-heading-3 text-ink">스케줄</h1>
      <p className="mt-1 mb-6 text-body-sm text-steel">
        cron 주기로 문서를 자동 생성합니다 (Mode C). 매분 평가되어 일치하는 스케줄이 실행됩니다.
      </p>

      <div className="mb-8">
        <ScheduleForm />
      </div>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        등록된 스케줄
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          등록된 스케줄이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => {
            const t = (s.template ?? {}) as Template;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {s.cron}
                    </code>
                    <Badge variant={s.enabled ? "secondary" : "outline"}>
                      {s.enabled ? "활성" : "중지"}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">
                    {t.title ?? "(제목 없음)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      t.type && (DOC_TYPE_LABELS[t.type] ?? t.type),
                      t.reader && `독자: ${t.reader}`,
                      t.length,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <ScheduleActions scheduleId={s.id} enabled={s.enabled} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
