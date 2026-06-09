import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { KbMatchView } from "@/lib/interview/store";

export function InsightBox({
  insight,
  matches,
}: {
  insight?: string;
  matches: KbMatchView[];
}) {
  return (
    <Card className="flex flex-col gap-4 border-transparent bg-tint-yellow-bold p-5 ring-0">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-brand-navy" aria-hidden />
        <h3 className="font-heading text-heading-5 text-brand-navy">
          매칭 인사이트
        </h3>
      </div>

      {insight ? (
        <p className="text-body-sm leading-relaxed text-brand-navy/80">
          {insight}
        </p>
      ) : (
        <p className="text-xs text-brand-navy/70">
          현재 단계와 관련된 사내 자료를 자동으로 찾아 응답에 반영합니다.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {matches.length === 0 ? (
          <p className="text-xs text-brand-navy/70">
            매칭된 자료가 없습니다. /kb 에서 URL/파일을 등록해 보세요.
          </p>
        ) : (
          matches.map((m, i) => (
            <div
              key={`${m.sourceId}-${i}`}
              className="flex flex-col gap-1 rounded-md bg-white/55 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-brand-navy">
                  {m.title ?? "(제목 없음)"}
                </span>
                <span className="shrink-0 text-xs text-brand-navy/60">
                  sim {m.sim.toFixed(2)}
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-brand-navy/70">
                {m.text.slice(0, 200)}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
