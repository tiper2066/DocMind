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
    <ol className="flex items-center gap-1 overflow-x-auto text-xs">
      {ANSWERABLE_STEPS.map((step) => {
        const stepIndex = STEPS.indexOf(step);
        const done = stepIndex < currentIndex;
        const active = step === currentStep;
        // 이미 답변했거나 현재보다 앞선 단계면 클릭해 되돌아갈 수 있다(현재 단계는 제외).
        const navigable =
          !!onGoto &&
          !active &&
          ((answers && answers[step] != null) || stepIndex < currentIndex);

        const cls = `flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${
          active
            ? "border-transparent bg-brand text-on-primary"
            : done
              ? "border-transparent bg-tint-lavender text-brand-purple-800"
              : "border-hairline text-steel"
        } ${navigable && !disabled ? "cursor-pointer hover:brightness-95" : ""} ${
          navigable && disabled ? "opacity-60" : ""
        }`;

        const inner = (
          <>
            {done ? (
              <Check className="h-3 w-3" aria-hidden />
            ) : (
              <span className="text-xs font-medium">
                {ANSWERABLE_STEPS.indexOf(step) + 1}
              </span>
            )}
            <span>{STEP_LABELS[step]}</span>
          </>
        );

        return (
          <li key={step}>
            {navigable ? (
              <button
                type="button"
                onClick={() => onGoto?.(step)}
                disabled={disabled}
                aria-label={`${STEP_LABELS[step]} 단계로 이동`}
                className={cls}
              >
                {inner}
              </button>
            ) : (
              <span className={cls} aria-current={active ? "step" : undefined}>
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
