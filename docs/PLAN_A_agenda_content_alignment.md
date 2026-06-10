# Plan A — Agenda ↔ 본문 슬라이드 정합 (생성 리팩터링 스펙)

> 작성 2026-06-10. **구현 완료 2026-06-10** (lint·build PASS). 아래는 원본 스펙이며 그대로 구현됨.
> 관련 코드: [src/lib/ppt/generate.ts](../src/lib/ppt/generate.ts) · [src/lib/prompts/outline.ts](../src/lib/prompts/outline.ts) · [src/lib/prompts/slide-fill.ts](../src/lib/prompts/slide-fill.ts) · [src/lib/ppt/types.ts](../src/lib/ppt/types.ts)

> **구현 메모(2026-06-10)**: outline.ts 를 `propose_plan`(sections:[{title,kind}] + includeQuote)로 교체. generate.ts 는 `bodyBudget = lengthPages − cover − (agenda?1) − cta` 를 계산하고 `proposePlan → normalizeSections(정확히 target개로 trim/pad) → agenda.items=section titles → section별 KB 검색(title 쿼리) → fillSlideOnce 에 forcedSlideTitle 주입(코드가 title 강제, fallback 도 동일) → cover/quote/cta/backCover 조립`. agenda 는 LLM fill 없이 코드가 직접 조립(호출 1회 절감). includeAgenda 는 `lengthPages≥6`. forcedSlideTitle(주제) 과 forcedTitle(사용자 수동 제목)은 변수명으로 구분. **한계**: 주제 수가 `AGENDA_MAX(9)` 를 넘으면(=lengthPages>12, agenda 있을 때) 주제를 9개로 캡 → 그 경우만 deck 이 lengthPages 보다 짧을 수 있음(데모 분량 ≤12 영향 없음). agenda 항목 max 도 7→9 로 상향.

---

## 1. 문제 (현재 동작)

생성된 PPT에서 **agenda 항목과 본문 슬라이드가 개수·제목 모두 어긋난다.**

예: agenda 6항목 vs 본문 7장(bullets/metric/twoCol/bullets/image/quote/bullets), 제목도 서로 무관.

### 근본 원인 — 두 갈래가 서로를 모름
1. [proposeOutline](../src/lib/ppt/generate.ts) 은 *슬라이드 종류 시퀀스*만 결정(길이=`lengthPages`). 본문 슬라이드 수 = `lengthPages − cover − agenda − cta`. **agenda 항목 수와 무관.**
2. 각 슬라이드 제목은 슬라이드별 [fillSlideOnce](../src/lib/ppt/generate.ts) LLM 호출이 **독립적으로** 생성.
3. agenda 항목도 agenda 슬라이드 fill 이 **따로** 만든 `items`.
4. 과거엔 agenda 가 `section` 디바이더 제목을 미러링([alignAgendaAndSections](../src/lib/ppt/generate.ts): 섹션≥2면 agenda items=섹션 제목)했으나, **section 슬라이드를 제거**(2026-06-10)하면서 그 유일한 끈이 끊김 → agenda 가 기준 없이 자유 작성됨.
5. [slide-fill.ts](../src/lib/prompts/slide-fill.ts) agenda 가이드에 *"section 슬라이드 title 과 동일 표기"* 라는 **stale 문구**가 남아 있음(맞출 대상이 없음).

---

## 2. 합의된 설계 — Plan A (플랜-퍼스트, 주제 주입형)

**한 줄**: 본문 주제 리스트를 먼저 계획하고, 그 리스트로 ① agenda.items 와 ② 각 본문 슬라이드 title 을 **동일하게** 설정하며, 주제를 fill 단계에 **주입**해 내용까지 그 주제에 맞춘다.

### 핵심 결정
- **quote, cta 는 agenda 에서 제외**(사용자 확정). 즉 agenda 항목 = "주제형 본문 슬라이드"들만. quote(고객 인용)·cta(마감)는 흐름상 들어가되 목차에는 안 올림.
- **제목을 사후에 덮어쓰지 않는다.** 주제를 생성 입력으로 넣어 제목·본문·KB 근거가 함께 그 주제를 향하게 한다. (사후 덮어쓰기는 "제목과 무관한 내용"을 만들므로 금지.)
- 플래너가 **주제 + 그 주제에 맞는 종류(kind)** 를 함께 결정한다(예: 지표→metric, 비교→twoCol, 개요/기능→bullets, 흐름→image).

### 새 생성 흐름
1. **플랜 단계**(기존 outline 대체/확장): LLM이 `sections: [{ title, kind }]` 를 N개 반환.
   - N = `lengthPages − 2`(cover·cta) − (agenda 넣을 경우 1) − (quote 넣을 경우 그 수). → 정확한 산식은 구현 시 확정하되, **agenda 에 올라가는 "주제 슬라이드" 수 = agenda 항목 수**가 되도록 맞춘다.
   - kind 는 `bullets|twoCol|metric|image` 중(주제형). quote/cta/cover/agenda/section/backCover 는 플랜의 "주제"가 아님.
   - quote 를 흐름에 넣을지는 플래너가 별도 플래그로 결정하거나 고정 위치(예: 후반부 1장)로 삽입. quote 는 agenda 미포함.
2. **agenda.items = sections.map(s => s.title)** (1:1, 동일 문자열).
3. **본문 슬라이드 생성**: 각 section 에 대해 fill 호출 시 **그 section.title 을 "이 슬라이드의 주제/제목"으로 강제 주입**. fill 은 그 주제의 본문만 작성하고 title 은 주제와 동일하게 반환(또는 코드가 title=주제로 고정).
4. **KB 검색을 주제별로**: 현재 `slideQueries = docTypeLabel + kind + reader + cta`(제네릭)를 **section.title 기반 쿼리**로 바꿔 그 주제에 맞는 청크를 가져온다. → 내용 정합·구체성 향상.
5. cover/cta/quote/backCover 는 기존처럼 생성하되 agenda 에는 안 들어감. backCover 는 지금처럼 맨 끝 자동 append.

### 슬라이드 순서(예)
`cover → agenda → [주제1..N: bullets/twoCol/metric/image] → (quote) → cta → backCover`
- agenda 는 주제1..N 만 나열(quote/cta/cover/backCover 제외).

---

## 3. 구현 대상 파일

| 파일 | 변경 |
|---|---|
| [src/lib/prompts/outline.ts](../src/lib/prompts/outline.ts) | outline 도구를 **plan 도구**로: `sections:[{title,kind}]`(+ quote 삽입 여부/위치, cover·agenda·cta 골격 규칙) 반환. 프롬프트에 "각 section.title 은 목차 항목이자 슬라이드 제목" 명시. |
| [src/lib/ppt/generate.ts](../src/lib/ppt/generate.ts) | 플랜 기반 재구성: ① 플랜 호출 → ② agenda.items=section titles ③ section별 KB 검색(title 쿼리) ④ fillSlideOnce 에 `forcedTitle`(=section.title) 주입 ⑤ quote/cta/cover/backCover 골격 조립. `alignAgendaAndSections` 의 section 분기 제거/단순화. `sectionsLeft`/`sectionIndex` 잔재 정리. |
| [src/lib/prompts/slide-fill.ts](../src/lib/prompts/slide-fill.ts) | fill 프롬프트에 `<slideTitle>`(주제) 주입 + "본문은 이 주제를 전개"·"title 은 주제와 동일". agenda 가이드의 **stale section 문구 제거**. |
| [src/lib/ppt/types.ts](../src/lib/ppt/types.ts) | (필요 시) plan 결과 타입. quote 는 agenda 제외이므로 quote 에 title 추가 **불필요**. |

> 주의: fillSlide 의 강제 title 주입 경로는 **인터뷰 생성([api/interview/finalize](../src/app/api/interview/finalize/route.ts))과 재생성([api/generate](../src/app/api/generate))** 양쪽에 동일하게 적용돼야 한다. 또 문서 제목 동기화 규칙(표지/meta/documents.title)과 충돌하지 않게 — 기존 `forcedTitle`(사용자 수동 제목) 로직과 이름이 겹치지 않도록 변수명 구분.

---

## 4. 엣지 케이스 / 주의

- **kind↔주제 궁합**: 플래너가 주제에 맞는 kind 를 골라야 함. 어긋나면 형식이 어색. 프롬프트로 가이드.
- **KB 커버리지**: 주제에 대한 사내 자료가 없으면 본문이 일반 원칙 수준(거짓 생성 금지 규칙 유지). 제목과 어긋나진 않음.
- **quote 처리**: agenda 미포함. 흐름엔 0~1장. 제목 필드 없음 그대로.
- **개수 일관성**: agenda 항목 수 == 주제 슬라이드 수 가 **구조적으로** 보장돼야 함(둘 다 동일한 `sections` 배열에서 파생).
- **하위 호환**: 기존 저장 deck 은 그대로 열려야 함(스키마 변경 최소화). image 슬라이드는 이미 nodes optional 처리됨.
- **lengthPages 산식**: cover+agenda+주제N+(quote)+cta = lengthPages 가 정확히 맞도록. backCover 는 별도 append(예산 외).

---

## 5. 완료 기준 (Acceptance)

1. 생성된 deck 에서 **agenda 항목 수 == 본문 주제 슬라이드 수**.
2. **agenda 각 항목 텍스트 == 대응 슬라이드 title** (정확히 동일 문자열).
3. 각 슬라이드 **본문 내용이 그 제목(주제)에 부합**(제목만 바뀐 게 아님).
4. quote/cta 는 agenda 에 없음, 흐름엔 존재.
5. `pnpm lint` · `pnpm build` PASS.
6. 미리보기·다운로드(.pptx) 양쪽에서 동일 확인.

---

## 6. 참고 — 이번 세션(2026-06-10)에 이미 적용된 PPT 수정 (재작업 금지)

Plan A 와 별개로 아래는 **이미 구현·빌드 통과**된 상태다:
- twoCol 본문 폰트 ↑(`size.bodyLg:24`), section 슬라이드 생성 제거(`OUTLINE_KINDS`),
  bullets 누적 Y(`bulletRowYs`), cover 제목 valign·폭·폰트 + `textOpts`/`boxStyle` valign 파라미터화,
  image 슬라이드 = 선형 flow 다이어그램(`diagramGeometry`, 박스+화살표; nodes/title optional 하위호환),
  Back Cover 슬라이드 추가(`BACK_COVER`, CTA 뒤 자동 append) + 에셋 종횡비 맞춤(awards 9.37:1, penta 8.86:1).
- 즉 **section 은 이미 안 생긴다.** Plan A 는 그 위에서 agenda↔주제 정합을 추가하는 작업이다.
