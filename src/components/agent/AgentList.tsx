import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<string, string> = {
  monitor: "감시",
  update: "갱신",
  notify: "알림",
  generate: "생성",
};

export type AgentListItem = {
  id: string;
  kind: string;
  status: string;
  autoRun: boolean;
  lastRunStatus: string | null;
};

export function AgentList({ agents }: { agents: AgentListItem[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">에이전트</h2>
      {agents.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          에이전트가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {agents.map((a) => (
            <li key={a.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {KIND_LABEL[a.kind] ?? a.kind}
                </span>
                <Badge variant={a.status === "active" ? "secondary" : "outline"}>
                  {a.status}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {a.autoRun ? "자동 실행" : "수동"}
                {a.lastRunStatus ? ` · 최근 ${a.lastRunStatus}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
