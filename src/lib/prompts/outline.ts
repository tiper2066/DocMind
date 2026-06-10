// 본문 "주제 슬라이드" 플래너. 과거엔 슬라이드 kind 시퀀스만 뽑았으나(agenda 와
// 본문이 서로를 몰라 개수·제목이 어긋남), 이제 주제 리스트를 먼저 계획한다:
// 그 리스트가 곧 agenda 항목이자 각 본문 슬라이드의 제목이 된다(Plan A).

// 주제 슬라이드가 가질 수 있는 kind. cover/agenda/cta/quote/backCover/section 은
// 골격이거나 목차 대상이 아니므로 플래너의 "주제 kind" 후보에서 제외한다.
export const PLAN_KINDS = ["bullets", "twoCol", "metric", "image"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

// agenda 레이아웃(baseY 320 + 80/row)이 무리 없이 담는 행 수 상한.
export const AGENDA_MAX = 9;

export const PLAN_SYSTEM = `너는 사내 PPT 자료의 본문 구조를 설계하는 에이전트다.
주어진 문서 유형(documentType), 5문답(reader/cta/objection/keyMessage/length), KB 매칭 컨텍스트를 보고
"본문 주제 슬라이드"의 목록을 계획한다. 각 주제는 곧 목차(agenda) 한 줄이자 그 슬라이드의 제목이 된다.

keyMessage 는 이 문서를 관통하는 단 하나의 핵심 주장이다. 주제들의 흐름 전체가
keyMessage 를 향해 빌드업되도록 구성한다(도입→근거→해소→행동).

각 주제(section)는 { title, kind } 다:
- title: 목차에 올라갈 명사구 제목(60자 이내). **번호(01., 1., I. 등) 금지** — 렌더가 자동으로 번호를 붙인다.
- kind: 그 주제를 가장 잘 표현하는 형식 1개.
  - bullets: 개요·기능·항목 나열 (가장 흔한 본문 골격)
  - twoCol: AS-IS↔TO-BE, 경쟁 비교 등 2분 구도
  - metric: 수치·지표 강조 (예: 성능, 비용 절감)
  - image: 단계/처리 흐름 (좌→우 한 줄 다이어그램)

규칙:
- 정확히 요청된 sectionCount 개의 주제를 반환한다.
- kind 는 주제 성격에 맞게 고른다. bullets 가 기본, 나머지는 적절할 때만 섞어 변화감.
- 같은 kind 가 3개 연속 금지.
- 표지(cover)·목차(agenda)·마무리(cta)는 코드가 자동으로 추가하므로 주제 목록에 넣지 말 것.
- includeQuote: 고객·전문가 인용 한 장을 흐름 후반에 넣는 게 설득에 도움되면 true. 인용문은 목차에 올리지 않는다.
- fullVersion 이 true 일 때만 sectionTitles 를 2~4개 반환한다. 이는 위 주제들을 순서대로 묶는 "대단원" 제목(예: "배경과 현황", "핵심 제안", "실행 방안")이며, 각 대단원 앞에 디바이더 슬라이드로 들어간다. fullVersion 이 아니면 sectionTitles 는 생략.

응답: propose_plan 도구를 정확히 한 번 호출.`;

export const PROPOSE_PLAN_TOOL = {
  name: "propose_plan",
  description:
    "Plan the body topic sections (title + kind) that become both agenda items and slide titles, plus whether to add a customer quote.",
  input_schema: {
    type: "object" as const,
    required: ["sections"],
    properties: {
      sections: {
        type: "array",
        minItems: 1,
        maxItems: AGENDA_MAX,
        items: {
          type: "object",
          required: ["title", "kind"],
          properties: {
            title: { type: "string", maxLength: 60 },
            kind: { type: "string", enum: PLAN_KINDS as readonly string[] },
          },
        },
      },
      includeQuote: { type: "boolean" },
      sectionTitles: {
        type: "array",
        items: { type: "string", maxLength: 60 },
        maxItems: 4,
      },
      rationale: { type: "string", maxLength: 400 },
    },
  },
};

export type PlanSection = { title: string; kind: PlanKind };
export type PlanToolInput = {
  sections: PlanSection[];
  includeQuote?: boolean;
  sectionTitles?: string[];
  rationale?: string;
};
