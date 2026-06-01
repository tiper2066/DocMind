import { Check } from "lucide-react";
import {
  ANSWERABLE_STEPS,
  STEP_LABELS,
  STEPS,
  type Step,
} from "@/lib/interview/machine";

export function ProgressTrack({ currentStep }: { currentStep: Step }) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <ol className="flex items-center gap-1 overflow-x-auto text-xs">
      {ANSWERABLE_STEPS.map((step) => {
        const stepIndex = STEPS.indexOf(step);
        const done = stepIndex < currentIndex;
        const active = step === currentStep;
        return (
          <li
            key={step}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${
              active
                ? "border-foreground bg-foreground text-background"
                : done
                  ? "border-foreground/30 text-muted-foreground"
                  : "border-border text-muted-foreground"
            }`}
          >
            {done ? (
              <Check className="h-3 w-3" aria-hidden />
            ) : (
              <span className="text-xs font-medium">
                {ANSWERABLE_STEPS.indexOf(step) + 1}
              </span>
            )}
            <span>{STEP_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
