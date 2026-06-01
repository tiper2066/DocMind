// 5단계 표시 설정 (클라 안전, db import 없음). Phase 8 에서 brand spectrum 으로 remap.
export const PHASES = [
  { key: "detect", label: "감지", text: "text-sky-600 dark:text-sky-400" },
  { key: "perceive", label: "인식", text: "text-violet-600 dark:text-violet-400" },
  { key: "reason", label: "판단", text: "text-amber-600 dark:text-amber-400" },
  { key: "act", label: "행동", text: "text-emerald-600 dark:text-emerald-400" },
  { key: "learn", label: "학습", text: "text-rose-600 dark:text-rose-400" },
] as const;

export type PhaseKey = (typeof PHASES)[number]["key"];

export const PHASE_INDEX: Record<string, number> = Object.fromEntries(
  PHASES.map((p, i) => [p.key, i]),
);

export function phaseLabel(key: string): string {
  return PHASES.find((p) => p.key === key)?.label ?? key;
}

export function phaseText(key: string): string {
  return PHASES.find((p) => p.key === key)?.text ?? "text-muted-foreground";
}
