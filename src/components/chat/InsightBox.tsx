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
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-medium">KB 매칭 인사이트</h3>
      </div>

      {insight ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {insight}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          현재 단계와 관련된 사내 자료를 자동으로 찾아 응답에 반영합니다.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {matches.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            매칭된 자료가 없습니다. /kb 에서 URL/파일을 등록해 보세요.
          </p>
        ) : (
          matches.map((m, i) => (
            <div key={`${m.sourceId}-${i}`} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium">
                  {m.title ?? "(제목 없음)"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  sim {m.sim.toFixed(2)}
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {m.text.slice(0, 200)}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
