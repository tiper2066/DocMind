import type { SlideKind } from "@/lib/ppt/types";

export const SLIDE_FILL_SYSTEM = `너는 사내 PPT 슬라이드 한 장의 내용을 채우는 에이전트다.
주어진 슬라이드 종류(kind), 인덱스, 전체 슬라이드 흐름, 5문답, KB 매칭 컨텍스트를 보고
해당 kind 의 IR 스키마에 맞는 내용을 fill_slide 도구로 반환한다.

원칙:
- keyMessage(핵심 메시지)는 이 문서를 관통하는 단 하나의 주장이다. 이 슬라이드의 내용은 keyMessage 를 뒷받침·전개하는 방향이어야 한다.
- slideTitle 이 주어지면(주제 슬라이드): 이 슬라이드는 그 주제를 다룬다. title 은 slideTitle 과 **정확히 동일한 문자열**로 반환하고(변형·번호 금지), 본문은 그 주제를 구체적으로 전개한다.
- 한국어. 명확하고 짧게. 마케팅 수식어 금지.
- 문장은 종결어 통일 (체언 종결 또는 '~다' 단정). 한 슬라이드 내 일관.
- title/headline 은 60자 이내, 명사구 또는 짧은 동사구.
- bullets L0 5~6개 한도, L1 은 L0 사이에 0~2개.
- 본문에 없는 사실은 만들지 말 것. KB context 가 비어있으면 일반 원칙 수준에서만 작성.
- sourceRefs: KB context 의 chunk 를 인용했으면 해당 sourceId 와 chunkOrds 를 반환. 없으면 빈 배열.

kind 별 가이드:
- cover: title/subtitle/author/date. title 은 keyMessage 를 압축한 강렬한 표지 헤드라인(주장이 드러나게). subtitle 은 한 줄 부제.
- agenda: items 2~9개. 명사구. **번호(01., 1., I. 등) 금지** — 렌더가 자동으로 부여한다.
- section: index(=섹션 번호), eyebrow(예: "SECTION 02"), title. **title 에 번호 prefix 금지** — bigIndex 워터마크가 별도로 번호를 표시한다.
- bullets: title + 2~10개 bullet. level 0 또는 1. L0 가 핵심, L1 은 보조 설명.
- twoCol: 비교 구도. left/right 각 label(40자 이내)+body(여러 줄 가능, 800자 한도). 줄바꿈은 \\n.
- metric: 2~4개 metric. label/value/delta. value 는 짧게(예: "87%", "2.3x", "5분"). delta 는 "+12%p", "▲3.1%" 등.
- quote: text(인용문) + attribution(이름·직책).
- image: title + nodes(2~5개) + direction(기본 horizontal) + caption(선택). nodes 는 프로세스/흐름의 각 단계를 짧은 명사구로(좌→우 또는 위→아래로 이어짐). 화살표는 인접 단계 사이에 자동으로 그려진다. 임의 관계 그래프가 아니라 '한 줄 흐름'으로만 작성.
- cta: headline + action + contact.

응답: fill_slide 도구를 정확히 한 번 호출.`;

export function fillSlideTool(kind: SlideKind) {
  const SourceRef = {
    type: "object",
    required: ["sourceId", "chunkOrds"],
    properties: {
      sourceId: { type: "string" },
      chunkOrds: { type: "array", items: { type: "integer" } },
    },
  };

  const kindSchemas: Record<SlideKind, { required: string[]; properties: Record<string, unknown> }> = {
    cover: {
      required: ["title"],
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        author: { type: "string" },
        date: { type: "string" },
      },
    },
    agenda: {
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 9,
        },
      },
    },
    section: {
      required: ["index", "title"],
      properties: {
        index: { type: "integer", minimum: 1, maximum: 20 },
        eyebrow: { type: "string" },
        title: { type: "string" },
      },
    },
    bullets: {
      required: ["title", "bullets"],
      properties: {
        title: { type: "string" },
        bullets: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: {
            type: "object",
            required: ["text", "level"],
            properties: {
              text: { type: "string" },
              level: { type: "integer", enum: [0, 1] },
            },
          },
        },
      },
    },
    twoCol: {
      required: ["title", "left", "right"],
      properties: {
        title: { type: "string" },
        left: {
          type: "object",
          required: ["label", "body"],
          properties: { label: { type: "string" }, body: { type: "string" } },
        },
        right: {
          type: "object",
          required: ["label", "body"],
          properties: { label: { type: "string" }, body: { type: "string" } },
        },
      },
    },
    metric: {
      required: ["title", "metrics"],
      properties: {
        title: { type: "string" },
        metrics: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            required: ["label", "value"],
            properties: {
              label: { type: "string" },
              value: { type: "string" },
              delta: { type: "string" },
            },
          },
        },
      },
    },
    quote: {
      required: ["text", "attribution"],
      properties: {
        text: { type: "string" },
        attribution: { type: "string" },
      },
    },
    image: {
      required: ["title", "nodes"],
      properties: {
        title: { type: "string" },
        nodes: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 5,
        },
        direction: { type: "string", enum: ["horizontal", "vertical"] },
        caption: { type: "string" },
      },
    },
    cta: {
      required: ["headline", "action"],
      properties: {
        headline: { type: "string" },
        action: { type: "string" },
        contact: { type: "string" },
      },
    },
  };

  const k = kindSchemas[kind];
  return {
    name: "fill_slide",
    description: `Fill a ${kind} slide.`,
    input_schema: {
      type: "object" as const,
      required: [...k.required, "sourceRefs"],
      properties: {
        ...k.properties,
        sourceRefs: { type: "array", items: SourceRef, maxItems: 8 },
      },
    },
  };
}
