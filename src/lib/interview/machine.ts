export const STEPS = [
  "type",
  "reader",
  "cta",
  "objection",
  "keyMessage",
  "length",
  "generate",
] as const;

export type Step = (typeof STEPS)[number];

export type AnswerableStep = Exclude<Step, "type" | "generate">;

export const ANSWERABLE_STEPS: AnswerableStep[] = [
  "reader",
  "cta",
  "objection",
  "keyMessage",
  "length",
];

export type Answers = Partial<Record<AnswerableStep, string>>;

export function nextStep(s: Step): Step | null {
  const i = STEPS.indexOf(s);
  if (i === -1 || i === STEPS.length - 1) return null;
  return STEPS[i + 1];
}

export function isLastAnswerable(s: Step): boolean {
  return s === "length";
}

export function isAnswerable(s: Step): s is AnswerableStep {
  return s !== "type" && s !== "generate";
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  sales: "영업 제안서",
  plan: "기획안",
  business: "사업 계획서",
  tech: "기술 문서",
  meeting: "회의 자료",
  marketing: "마케팅 자료",
};

export const STEP_LABELS: Record<AnswerableStep, string> = {
  reader: "독자",
  cta: "콜투액션",
  objection: "예상 반론",
  keyMessage: "핵심 메시지",
  length: "분량",
};
