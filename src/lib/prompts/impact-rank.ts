export const IMPACT_RANK_SYSTEM = `너는 사내 문서 자동 갱신 에이전트의 "판단(reason)" 단계다.
한 지식 소스가 변경되었고, 그 소스를 참조하는 문서 목록이 주어진다.
각 문서가 이번 변경으로 갱신이 필요한지 판단해 우선순위를 매기고 rank_impact 도구로 반환한다.

규칙:
- 각 문서마다 priority: high(즉시 갱신 권장) | medium | low.
- shouldRegenerate: 이번 변경이 그 문서 내용에 실질적 영향을 주면 true.
- rationale: 한국어 1문장. 왜 그 우선순위인지. 추측·과장 금지.
- 변경 summary 와 문서의 유형/독자/주제를 함께 고려. 관련성이 낮으면 low + shouldRegenerate=false.

응답은 rank_impact 도구를 정확히 한 번 호출. impacts 배열은 입력 문서와 1:1.`;

export const RANK_IMPACT_TOOL = {
  name: "rank_impact",
  description:
    "Rank how each referencing document is impacted by the source change.",
  input_schema: {
    type: "object" as const,
    required: ["impacts"],
    properties: {
      impacts: {
        type: "array",
        items: {
          type: "object",
          required: ["documentId", "priority", "rationale", "shouldRegenerate"],
          properties: {
            documentId: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            rationale: { type: "string", maxLength: 300 },
            shouldRegenerate: { type: "boolean" },
          },
        },
        minItems: 0,
        maxItems: 30,
      },
    },
  },
};

export type RankImpactInput = {
  impacts: Array<{
    documentId: string;
    priority: "high" | "medium" | "low";
    rationale: string;
    shouldRegenerate: boolean;
  }>;
};
