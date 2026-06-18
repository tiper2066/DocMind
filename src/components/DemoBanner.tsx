import { Info } from "lucide-react";
import { UI_ONLY } from "@/lib/demo-mode";

// UI-only 데모 모드일 때만 앱 최상단에 상시 노출되는 안내 배너. 실서비스
// (DEMO_UI_ONLY 미설정)에선 렌더되지 않는다.
export function DemoBanner() {
  if (!UI_ONLY) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <Info className="size-4 shrink-0" aria-hidden />
      <span>
        [안내] 현재 API 연결 해제 상태로, UI(화면) 둘러보기만 가능합니다. (AI 기능
        임시 중단)
      </span>
    </div>
  );
}
