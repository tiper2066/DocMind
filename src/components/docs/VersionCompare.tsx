import { SlidePreview } from "@/components/deck/SlidePreview";
import { CANVAS_W, CANVAS_H } from "@/lib/ppt/render";
import {
  diffSlidePairs,
  slideLines,
  type DiffRow,
  type SlidePair,
  type SlidePairType,
} from "@/lib/diff";
import type { Deck } from "@/lib/ppt/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const THUMB_W = 330;
const THUMB_H = Math.round((THUMB_W * CANVAS_H) / CANVAS_W);

const PAIR_BADGE: Record<
  SlidePairType,
  { label: string; variant: "default" | "secondary" | "destructive" | "ghost" }
> = {
  same: { label: "동일", variant: "ghost" },
  changed: { label: "변경", variant: "default" },
  added: { label: "신규", variant: "secondary" },
  removed: { label: "삭제", variant: "destructive" },
};

function pairNumberLabel(p: SlidePair): string {
  if (p.baseIndex != null && p.targetIndex != null) {
    return p.baseIndex === p.targetIndex
      ? `#${p.targetIndex + 1}`
      : `#${p.baseIndex + 1} → #${p.targetIndex + 1}`;
  }
  return p.baseIndex != null
    ? `#${p.baseIndex + 1}`
    : `#${(p.targetIndex ?? 0) + 1}`;
}

export function DiffRows({ rows }: { rows: DiffRow[] }) {
  return (
    <pre className="overflow-x-auto rounded-lg border p-3 text-xs leading-6">
      {rows.map((r, i) => (
        <div
          key={i}
          className={
            r.type === "add"
              ? "bg-success/10 text-success"
              : r.type === "del"
                ? "bg-error/10 text-error"
                : "text-muted-foreground"
          }
        >
          <span className="select-none opacity-60">
            {r.type === "add" ? "+ " : r.type === "del" ? "− " : "  "}
          </span>
          {r.text}
        </div>
      ))}
    </pre>
  );
}

function SameRunNote({
  count,
  from,
  to,
}: {
  count: number;
  from: number;
  to: number;
}) {
  return (
    <p className="rounded border border-dashed px-3 py-1.5 text-center text-xs text-muted-foreground">
      동일한 슬라이드 {count}장 생략 (#{from}
      {to !== from ? `–#${to}` : ""})
    </p>
  );
}

function EmptyThumb({ label }: { label: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded border border-dashed text-xs text-muted-foreground"
      style={{ width: THUMB_W, height: THUMB_H }}
    >
      {label}
    </div>
  );
}

type RenderItem =
  | { kind: "pair"; pair: SlidePair }
  | { kind: "sameRun"; count: number; from: number; to: number };

// 연속된 동일 쌍을 한 줄 요약으로 접는다 (번호는 최신 버전 기준).
function toRenderItems(pairs: SlidePair[]): RenderItem[] {
  const items: RenderItem[] = [];
  let run: SlidePair[] = [];
  const flushRun = () => {
    if (run.length === 0) return;
    items.push({
      kind: "sameRun",
      count: run.length,
      from: (run[0].targetIndex ?? 0) + 1,
      to: (run[run.length - 1].targetIndex ?? 0) + 1,
    });
    run = [];
  };
  for (const p of pairs) {
    if (p.type === "same") {
      run.push(p);
    } else {
      flushRun();
      items.push({ kind: "pair", pair: p });
    }
  }
  flushRun();
  return items;
}

// 하이브리드 버전 비교: 좌(이전)·우(최신) 슬라이드 쌍 + 변경된 쌍 아래에만 라인 diff.
// 변경 없는 슬라이드는 썸네일 대신 한 줄 요약으로 접는다.
export function VersionCompare({
  base,
  target,
  baseVersion,
  targetVersion,
}: {
  base: Deck;
  target: Deck;
  baseVersion: number;
  targetVersion: number;
}) {
  const items = toRenderItems(diffSlidePairs(base, target));

  return (
    <div className="space-y-3">
      <div className="flex gap-4 overflow-x-auto text-xs font-medium text-muted-foreground">
        <span className="shrink-0" style={{ width: THUMB_W }}>
          v{baseVersion} (이전)
        </span>
        <span className="shrink-0" style={{ width: THUMB_W }}>
          v{targetVersion} (최신)
        </span>
      </div>

      <ol className="space-y-6">
        {items.map((item, idx) => {
          if (item.kind === "sameRun") {
            return (
              <li key={idx}>
                <SameRunNote count={item.count} from={item.from} to={item.to} />
              </li>
            );
          }
          const p = item.pair;
          const badge = PAIR_BADGE[p.type];
          const numberLabel = pairNumberLabel(p);
          return (
            <li key={idx} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  {numberLabel}
                </span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-1">
                {p.baseIndex != null ? (
                  <div
                    className={cn(
                      "shrink-0 rounded",
                      p.type === "changed" && "ring-2 ring-primary/50",
                      p.type === "removed" && "ring-2 ring-error/50",
                    )}
                  >
                    <SlidePreview
                      slide={base.slides[p.baseIndex]}
                      meta={base.meta}
                      width={THUMB_W}
                    />
                  </div>
                ) : (
                  <EmptyThumb label="이전 버전에 없음" />
                )}
                {p.targetIndex != null ? (
                  <div
                    className={cn(
                      "shrink-0 rounded",
                      p.type === "changed" && "ring-2 ring-primary/50",
                      p.type === "added" && "ring-2 ring-success/50",
                    )}
                  >
                    <SlidePreview
                      slide={target.slides[p.targetIndex]}
                      meta={target.meta}
                      width={THUMB_W}
                    />
                  </div>
                ) : (
                  <EmptyThumb label="새 버전에서 삭제됨" />
                )}
              </div>

              {p.type === "changed" && <DiffRows rows={p.rows} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// 모바일용 텍스트 전용 비교 — 썸네일 없이 변경 슬라이드의 라인 diff 만.
// 신규/삭제 슬라이드는 전체 내용을 +/− 라인으로 합성해 보여준다.
export function VersionCompareText({
  base,
  target,
}: {
  base: Deck;
  target: Deck;
}) {
  const items = toRenderItems(diffSlidePairs(base, target));

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        if (item.kind === "sameRun") {
          return (
            <SameRunNote
              key={idx}
              count={item.count}
              from={item.from}
              to={item.to}
            />
          );
        }
        const p = item.pair;
        const badge = PAIR_BADGE[p.type];
        const rows: DiffRow[] =
          p.type === "changed"
            ? p.rows
            : p.type === "added"
              ? slideLines(target.slides[p.targetIndex ?? 0]).map((text) => ({
                  type: "add" as const,
                  text,
                }))
              : slideLines(base.slides[p.baseIndex ?? 0]).map((text) => ({
                  type: "del" as const,
                  text,
                }));
        return (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {pairNumberLabel(p)}
              </span>
            </div>
            <DiffRows rows={rows} />
          </div>
        );
      })}
    </div>
  );
}
