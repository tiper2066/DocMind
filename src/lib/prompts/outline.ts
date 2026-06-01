import { SLIDE_KINDS, type SlideKind } from "@/lib/ppt/types";

export const OUTLINE_SYSTEM = `너는 사내 PPT 자료의 슬라이드 구조를 설계하는 에이전트다.
주어진 문서 유형(documentType), 5문답(reader/cta/objection/sources/length), KB 매칭 컨텍스트를 보고
1920×1080 슬라이드를 정확히 lengthPages 장 만큼의 시퀀스로 제안한다.

사용 가능한 슬라이드 종류 (kind): ${SLIDE_KINDS.join(", ")}

규칙:
- 첫 장은 반드시 'cover'.
- 마지막 장은 반드시 'cta'.
- 6장 이상이면 2번째에 'agenda' 권장. 8장 이상이면 본문 중간에 'section' 디바이더 1~2개.
- 'bullets' 가 가장 자주 등장하는 본문 골격. 'twoCol' (비교), 'metric' (지표), 'quote' (고객·전문가 인용), 'image' (다이어그램·스크린샷) 도 섞어 변화감.
- 같은 kind 가 연달아 3장 이상 등장 금지.
- 총 길이는 정확히 lengthPages.

응답: propose_outline 도구를 정확히 한 번 호출. kinds 배열만 반환.`;

export const PROPOSE_OUTLINE_TOOL = {
  name: "propose_outline",
  description: "Propose an ordered slide kind sequence for the deck.",
  input_schema: {
    type: "object" as const,
    required: ["kinds"],
    properties: {
      kinds: {
        type: "array",
        items: { type: "string", enum: SLIDE_KINDS as readonly string[] },
        minItems: 4,
        maxItems: 30,
      },
      rationale: { type: "string", maxLength: 400 },
    },
  },
};

export type OutlineToolInput = {
  kinds: SlideKind[];
  rationale?: string;
};
