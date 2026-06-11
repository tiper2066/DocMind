"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const PRESENTER_LOCK_MESSAGE = "데모버전이며 발표자만 작동가능합니다.";

// 발표자 화이트리스트(TREND_ADMIN_EMAILS/APPROVAL_ADMIN_EMAILS) 밖 사용자에게
// 버튼 비활성 사유를 hover 툴팁으로 안내. disabled 요소는 마우스 이벤트를 받지
// 못하므로 트리거는 래퍼 span — 내부 disabled 요소는 pointer-events-none 이어야 한다.
export function PresenterLockTooltip({
  locked,
  className,
  children,
}: {
  locked: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={cn("cursor-not-allowed", className)} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{PRESENTER_LOCK_MESSAGE}</TooltipContent>
    </Tooltip>
  );
}
