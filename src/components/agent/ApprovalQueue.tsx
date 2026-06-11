import { Badge } from "@/components/ui/badge";
import { ApprovalActions } from "./ApprovalActions";

export type PendingApproval = {
  id: string;
  kind: string;
  docTitle: string | null;
  payload: unknown;
};

export type RejectedApproval = {
  id: string;
  kind: string;
  docTitle: string | null;
  payload: unknown;
};

export type HighlightedApproval = {
  id: string;
  decision: string | null;
  docTitle: string | null;
};

type ApprovalPayload = {
  version?: number;
  changeNote?: string;
  sourceTitle?: string | null;
  changeRatio?: number;
};

function cardTitle(kind: string, docTitle: string | null, p: ApprovalPayload) {
  if (kind === "regenerate") return p.sourceTitle ?? "(소스)";
  return docTitle ?? "(문서)";
}

export function ApprovalQueue({
  pending,
  rejected,
  highlighted,
  highlightId,
}: {
  pending: PendingApproval[];
  rejected: RejectedApproval[];
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
            const p = (a.payload ?? {}) as ApprovalPayload;
            return (
              <li
                key={a.id}
                className={
                  a.id === highlightId
                    ? "rounded-lg border-2 border-primary p-4"
                    : "rounded-lg border p-4"
                }
              >
                <div className="text-sm font-medium">
                  {cardTitle(a.kind, a.docTitle, p)}
                </div>
                {a.kind === "regenerate" ? (
                  <>
                    <div className="text-xs text-muted-foreground">
                      소스 변경 감지
                      {p.changeRatio != null &&
                        ` · 변경 비율 ${Math.round(p.changeRatio * 100)}%`}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      승인 시 인식→판단→행동→학습 단계를 거쳐 영향 문서를
                      갱신·발행합니다.
                    </p>
                  </>
                ) : (
                  <>
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
                  </>
                )}
                <div className="mt-3">
                  <ApprovalActions approvalId={a.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {rejected.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-sm font-medium text-muted-foreground">
            최근 거부
          </h2>
          <ul className="space-y-3">
            {rejected.map((a) => {
              const p = (a.payload ?? {}) as ApprovalPayload;
              return (
                <li
                  key={a.id}
                  className="rounded-lg border p-4 opacity-80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">
                      {cardTitle(a.kind, a.docTitle, p)}
                    </div>
                    <Badge variant="destructive">거부</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.kind === "regenerate"
                      ? "소스 변경 감지 — 갱신하지 않음"
                      : p.version != null
                        ? `v${p.version} 드래프트 — 발행하지 않음`
                        : "발행하지 않음"}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
