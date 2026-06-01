import { Badge } from "@/components/ui/badge";
import { ApprovalActions } from "./ApprovalActions";

export type PendingApproval = {
  id: string;
  docTitle: string | null;
  payload: unknown;
};

export type HighlightedApproval = {
  id: string;
  decision: string | null;
  docTitle: string | null;
};

export function ApprovalQueue({
  pending,
  highlighted,
  highlightId,
}: {
  pending: PendingApproval[];
  highlighted: HighlightedApproval | null;
  highlightId?: string;
}) {
  return (
    <div>
      {highlighted && (
        <div className="mb-4 rounded-lg border-2 border-primary p-4">
          <div className="mb-1 text-xs font-medium text-primary">
            링크로 열린 승인
          </div>
          <div className="text-sm font-medium">
            {highlighted.docTitle ?? "(문서)"}
          </div>
          <Badge
            variant={
              highlighted.decision === "reject" ? "destructive" : "outline"
            }
            className={
              highlighted.decision === "approve"
                ? "mt-2 border-transparent bg-success text-on-primary"
                : "mt-2"
            }
          >
            {highlighted.decision === "approve"
              ? "발행 승인됨"
              : highlighted.decision === "reject"
                ? "거부됨"
                : "대기 중"}
          </Badge>
        </div>
      )}

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">승인 큐</h2>
      {pending.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          대기 중인 승인이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((a) => {
            const p = (a.payload ?? {}) as {
              version?: number;
              changeNote?: string;
            };
            return (
              <li
                key={a.id}
                className={
                  a.id === highlightId
                    ? "rounded-lg border-2 border-primary p-4"
                    : "rounded-lg border p-4"
                }
              >
                <div className="text-sm font-medium">{a.docTitle ?? "(문서)"}</div>
                {p.version != null && (
                  <div className="text-xs text-muted-foreground">
                    v{p.version} 드래프트
                  </div>
                )}
                {p.changeNote && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {p.changeNote}
                  </p>
                )}
                <div className="mt-3">
                  <ApprovalActions approvalId={a.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
