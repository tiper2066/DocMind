// 5단계 표시 설정 (클라 안전, db import 없음). brand spectrum 토큰(고채도 중간톤 → 라이트/다크 공용).
export const PHASES = [
  { key: "detect", label: "감지", text: "text-link-blue" },
  { key: "perceive", label: "인식", text: "text-brand-purple" },
  { key: "reason", label: "판단", text: "text-brand-orange" },
  { key: "act", label: "행동", text: "text-brand-teal" },
  { key: "learn", label: "학습", text: "text-brand-pink" },
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
