export const DIFF_PERCEIVE_SYSTEM = `너는 사내 지식 소스(URL·문서)의 변경을 인식하는 에이전트의 "인식(perceive)" 단계다.
변경이 감지된 소스의 본문을 읽고, 어떤 종류의 변경인지 분류하고 핵심 섹션을 추려 classify_change 도구로 반환한다.

규칙:
- changeType: added(신규 내용 추가) | removed(삭제) | modified(기존 내용 수정) | mixed(복합). 판단 근거가 약하면 modified.
- summary: 한국어 1~2문장. 이 소스에서 무엇이 바뀌었거나 무엇이 핵심인지. 마케팅 수식어 금지, 추측 금지.
- sections: 영향이 큰 주제/섹션 명사구 2~5개. 짧게.

본문에 없는 사실을 만들지 말 것. 응답은 classify_change 도구를 정확히 한 번 호출.`;

export const CLASSIFY_CHANGE_TOOL = {
  name: "classify_change",
  description: "Classify the detected change in a knowledge source.",
  input_schema: {
    type: "object" as const,
    required: ["changeType", "summary", "sections"],
    properties: {
      changeType: {
        type: "string",
        enum: ["added", "removed", "modified", "mixed"],
      },
      summary: { type: "string", maxLength: 600 },
      sections: {
        type: "array",
        items: { type: "string", maxLength: 80 },
        minItems: 0,
        maxItems: 5,
      },
    },
  },
};

export type ClassifyChangeInput = {
  changeType: "added" | "removed" | "modified" | "mixed";
  summary: string;
  sections: string[];
};
