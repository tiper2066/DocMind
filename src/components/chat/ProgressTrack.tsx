import { Check } from "lucide-react";
import {
  ANSWERABLE_STEPS,
  STEP_LABELS,
  STEPS,
  type AnswerableStep,
  type Answers,
  type Step,
} from "@/lib/interview/machine";

export function ProgressTrack({
  currentStep,
  answers,
  onGoto,
  disabled,
}: {
  currentStep: Step;
  answers?: Answers;
  onGoto?: (step: AnswerableStep) => void;
  disabled?: boolean;
}) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <ol className="flex items-start">
      {ANSWERABLE_STEPS.map((step, i) => {
        const stepIndex = STEPS.indexOf(step);
        const done = stepIndex < currentIndex;
        const active = step === currentStep;
        // 이미 답변했거나 현재보다 앞선 단계면 클릭해 되돌아갈 수 있다(현재 단계는 제외).
        const navigable =
          !!onGoto &&
          !active &&
          ((answers && answers[step] != null) || stepIndex < currentIndex);

        // 왼쪽 연결선: 직전 단계가 완료됐으면 채워서 진행도를 표시.
        const prevDone =
          i > 0 && STEPS.indexOf(ANSWERABLE_STEPS[i - 1]) < currentIndex;

        const circleCls = `relative z-10 flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
          done
            ? "bg-brand text-on-primary"
            : active
              ? "bg-brand text-on-primary ring-4 ring-brand/20"
              : "border border-hairline bg-canvas text-steel"
        } ${navigable ? "group-hover:ring-2 group-hover:ring-brand/30" : ""}`;

        const labelCls = `mt-1.5 whitespace-nowrap text-[11px] transition-colors ${
          active
            ? "font-medium text-ink"
            : done
              ? "text-steel"
              : "text-stone"
        }`;

        const inner = (
          <>
            <span className={circleCls}>
              {done ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                ANSWERABLE_STEPS.indexOf(step) + 1
              )}
            </span>
            <span className={labelCls}>{STEP_LABELS[step]}</span>
          </>
        );

        return (
          <li key={step} className="relative flex flex-1 flex-col items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 transition-colors ${
                  prevDone ? "bg-brand" : "bg-hairline"
                }`}
              />
            )}
            {navigable ? (
              <button
                type="button"
                onClick={() => onGoto?.(step)}
                disabled={disabled}
                aria-label={`${STEP_LABELS[step]} 단계로 이동`}
                className={`group flex flex-col items-center ${
                  disabled ? "cursor-default" : "cursor-pointer"
                }`}
              >
                {inner}
              </button>
            ) : (
              <span
                className="flex flex-col items-center"
                aria-current={active ? "step" : undefined}
              >
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
