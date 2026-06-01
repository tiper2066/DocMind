import { Loader2 } from "lucide-react";

export default function ChatLoading() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Loader2 className="size-9 animate-spin text-brand" aria-hidden />
      <div className="space-y-1">
        <p className="font-heading text-heading-5 text-ink">
          인터뷰를 준비하고 있어요
        </p>
        <p className="text-body-sm text-steel">
          첫 질문을 만드는 중입니다. 잠시만 기다려 주세요.
        </p>
      </div>
    </div>
  );
}
