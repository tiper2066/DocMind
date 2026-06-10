# DocMind Agent — Claude 작업 가이드

> 이 파일은 **매 새 대화의 출발점**이다. 짧게 유지하고, 상세 내용은 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 를 본다.

---

## 0. 새 대화에서 가장 먼저 할 일 (필독)

1. [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) **전체를 한 번 훑는다**. 특히:
   - 1장 Context — 무엇을, 왜
   - 2장 기술 스택 — 어떤 도구를 쓰는지
   - **15장 Phase별 구현 계획** — 진행 상태 체크박스로 "어디까지 왔는지" 파악
   - 16장 결정 로그 — 왜 그 선택을 했는지
2. 본 CLAUDE.md 의 **2. 현재 진행 상태** 섹션에서 활성 Phase 확인.
3. 사용자가 요청한 작업이 어느 Phase 의 어느 항목에 해당하는지 매핑한 뒤 시작.

작업 도중·끝에는 **4. 작업 워크플로우** 섹션의 갱신 규칙을 반드시 따른다.

---

## 1. 한 줄 정의

펜타시큐리티 디자인팀의 **AI Agent Hack 2026** 출품작. 사내 URL·파일을 학습한 AI가 5질문 인터뷰로 PPT를 자동 생성하고, 소스 변경을 자율 감지해 문서를 갱신·알림하는 에이전트.

원본 기획서: [docs/DocMind_Agent_기획서.pdf](docs/DocMind_Agent_기획서.pdf) (6장 가격 정책은 구현 범위 제외)

> **UI 표기명은 "Mind5"** (2026-06-02~). 화면(탭 제목·로그인·네비)과 발행 이메일만 Mind5 로 표기한다. 내부 코드·식별자(Inngest 앱 id `docmind`, Slack `#docmind-demo`, 패키지명)와 본 문서들은 "DocMind" 를 유지한다.

---

## 2. 현재 진행 상태

> 작업이 끝날 때마다 이 섹션을 갱신할 것. 한 줄짜리 "어디까지 왔나" 가 항상 최신이어야 한다.

| 항목 | 값 |
|---|---|
| **활성 Phase** | Phase 9 — 데모 준비 & 최종 검증 |
| **완료 Phase** | Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8 |
| **다음 액션** | Phase 9 잔여: 사전생성 인터뷰 fallback 캐시, 7항목 라이브 검증, 리허설(A<3분·B<2분), 백업 mp4 녹화·배치, WCAG AA 대비 감사, Sentry 알람룰·Vercel alias. **데모팀 액션**: seed-demo `DEMO_FILES` 실제 URL, `public/demo/*.mp4` 배치. |
| **마지막 갱신** | 2026-06-10 (**PPT 생성·보안레벨 묶음 — 이번 세션 3건 통합** / 상세 Plan 16장·[PLAN_A 문서](docs/PLAN_A_agenda_content_alignment.md), lint·build PASS) · **① Plan A — agenda↔본문 정합**: [outline.ts](src/lib/prompts/outline.ts) `propose_outline`→**`propose_plan`**(`sections:[{title,kind}]`+`includeQuote`+풀버전 `sectionTitles`), [generate.ts](src/lib/ppt/generate.ts)가 `bodyBudget` 산정→`normalizeSections`(정확히 target개)→**agenda.items=토픽 제목**(코드 직접 조립)→토픽별 KB 검색(title 쿼리)→`fillSlideOnce`에 `forcedSlideTitle` 강제. 결과: agenda 항목수==본문 토픽수·텍스트==슬라이드 title. `PLAN_KINDS`=bullets/twoCol/metric/image, `AGENDA_MAX`=9. · **② 인터뷰 보안레벨 선택**: 마지막 `length` 단계 UI를 드롭다운 2개(분량+보안 Level1~5)로([ChatView](src/components/chat/ChatView.tsx)), 진행칩 라벨 "분량 및 보안 레벨"([machine.ts](src/lib/interview/machine.ts)), 보안레벨 클라 state→[finalize](src/app/api/interview/finalize/route.ts)→`generateDeck`→`meta.securityLevel`(하드코딩 1 제거). · **③ PPT 디자인**: 푸터 하단바 kind별 색(agenda `#F2F2F2`·section `#D9D9D9`·나머지 `#000000`, [tokens.ppt.json](src/design/tokens.ppt.json) `footerMaster.body.barFill`+[layouts.ts](src/lib/ppt/layouts.ts) `footerBarFill`/`footerIsDarkBar`), 검정 바에서만 보안칩=`_dark`·로고=`penta_white_small`. 슬라이드 **제목색 `#0060A9`**(신규 토큰 `color.title`, 7개 `role:'title'`). **cover 우측하단 보안칩**(`coverMaster.securityChip`, non-dark). **section 디바이더는 풀버전(16장+)만**(`distributeEvenly`, 목차 미포함). 미리보기·다운로드 동시 반영([render.tsx](src/lib/ppt/render.tsx)·[pptx.ts](src/lib/ppt/pptx.ts)). |
| **(이전 갱신)** | 2026-06-10 (**PPT 생성 품질 수정 묶음**: 헤더 로그아웃 tooltip([tooltip.tsx](src/components/ui/tooltip.tsx)), 미리보기 페이지 16:9 비율 버그 수정(SlidePreview flexShrink:0 + DeckViewer ResizeObserver)·닫기 X·max-w-6xl, 설정 문서템플릿 배경([TemplateCard](src/components/settings/TemplateCard.tsx)), **.pptx 한글 파일명 깨짐 수정**(동일출처 API 바이트 스트리밍 + RFC5987 `filename*`), twoCol 본문폰트↑, section 슬라이드 생성 제거, bullets 누적 Y, cover 제목 정비, image=선형 flow 다이어그램, Back Cover 슬라이드 추가. lint·build PASS.) 2026-06-09 (**데모 UI/UX 폴리시 묶음**: ① 문서 상세 버전 타임라인 — PPTX 생링크(JSON 노출 버그) → fetch 다운로드 버튼([PptxDownloadLink](src/components/docs/PptxDownloadLink.tsx)), 미리보기(검정)·다운로드(primary) 버튼화, "최신과 비교" 텍스트 제거 → **카드 전체 클릭 비교**(오버레이 링크 + 안쪽 버튼 z-10 분리, [VersionCard](src/components/docs/VersionCard.tsx)), 최신 버전 카드 검정 테두리. ② 문서함 카드 **New**(생성 24h·primary)·**Update**(갱신 24h+버전>1·검정) 뱃지(SQL `now()` 계산, [DocsFolderView](src/components/docs/DocsFolderView.tsx)). ③ 에이전트 카드 발행 뱃지 좌측 **생성일자**(서버 포맷), [LoopDiagram](src/components/agent/LoopDiagram.tsx) 노드 **불투명 백드롭**(반투명 라인 겹침 해소). ④ 인터뷰 [ProgressTrack](src/components/chat/ProgressTrack.tsx) 단계 원형 반투명 제거(라인 겹침), 입력 placeholder·버튼 "직접 입력", **되돌아가기 시 원래 질문 복원**([store](src/lib/interview/store.ts)·[ChatView](src/components/chat/ChatView.tsx)·프롬프트에 currentStep 고정 규칙), 생성 버튼 "문서 생성", 인사이트 카드 제목 "매칭 인사이트". ⑤ 홈 "맞춤 문서 만들기" → **풀폭 입력 카드**(타이틀+textarea+전송아이콘, 입력만 가능·기능없음, [page](src/app/(app)/page.tsx)). ⑥ KB 카드 액션(수정/삭제) 평소 숨김 → **hover 시 중앙 표시 + 어두운 스크림**([kb/page](src/app/(app)/kb/page.tsx)). ⑦ 데모용 `pnpm demo:pending`(KEEP_PENDING — 자동승인 생략, 대기 카드 유지). 상세 Plan 16장 2026-06-09. lint·build PASS. **이전(동일자)**: **KB 소스 "수정(내용 교체)" 기능** — 파일 소스를 새 파일로 교체(content_hash 유지) 또는 URL 재감지 후 `agent/detect.requested` 발화 → detect 가 라이브 새 내용 vs 옛 해시 비교 → 5%↑ 변경 시 영향 PPT 가 대기 문서로(문서 발행 수동 전제). [PATCH /api/kb/sources/[id]](src/app/api/kb/sources/[id]/route.ts), detect scan 을 "명시 트리거 시 파일 포함·cron 은 URL만"으로 변경([agent.ts](src/inngest/agent.ts)), [SourceActions](src/components/kb/SourceActions.tsx)에 연필(파일 교체)/새로고침(URL 재감지) 버튼. force-change 강제 데모 대신 실제 갱신 흐름으로 Demo B 시연 가능. 한계: 소스 청크/요약은 재생성 안 함(기존 루프 동작과 동일). 상세 Plan 16장 2026-06-09. lint·build PASS. **이전(동일자)**: 인터뷰 4단계 **`sources`→`keyMessage`(핵심 메시지) 교체** — sources 답변이 생성에서 KB 필터로 안 쓰이고 힌트로만 들어가 가치 낮음, KB 는 자동 참조되므로 "한 줄 핵심 주장"으로 대체. outline·slide-fill 프롬프트에 "덱의 축·표지 헤드라인=keyMessage 압축" 반영, generate `<answers>`·스케줄 경로(schedule.ts·agent.ts·ScheduleForm)까지 일괄. machine STEPS·STEP_LABELS·interview 프롬프트·service `STEPS_NEEDING_FRESH_KB` 비움. DB 변경 없음. 데모 대본 문서(CLAUDE·TEST_GUIDE·Plan)도 소스→핵심메시지로 갱신. 상세 Plan 16장 2026-06-09. lint·build PASS. **이전(06-08) — 데모 코드 산출물**: [seed-demo.ts](scripts/seed-demo.ts)(KB 시드·멱등·부분실패 허용, `DEMO_FILES` 배열로 파일소스 주입), [warmup.ts](scripts/warmup.ts)(DB·Anthropic·Voyage·Inngest 핑), [/demo/playback](src/app/demo/playback/page.tsx)(public/demo/*.mp4 자동 재생/배치 안내) 신규. package.json `seed:demo`·`warmup` 배선. Plan 15장 Phase 9 체크박스 4건 갱신(force-change 기완료 반영, WCAG AA 대비 감사 이월 항목 추가). lint·build PASS. **이전 동일자**: **문서 제목 사용자 편집**: 상세 페이지 h1 인라인 편집([DocTitleEditor](src/components/docs/DocTitleEditor.tsx)) + `PATCH /api/documents/[id]`. `documents.title_manual` 컬럼(마이그레이션 0003) 추가 → 사용자 제목이면 finalize·generate 재생성 시 LLM 표지 제목으로 **덮어쓰지 않음**(`forcedTitle` 로 표지·meta 역동기화). 제목 변경 시 전 버전 `slidesJson` meta.title·표지 slides[0].title 갱신 + 캐시 pptx 무효화. 인터뷰 질문 이모지 금지 규칙([interview.ts](src/lib/prompts/interview.ts)), 입력 중 점 애니메이션 진폭 확대(`dot-bounce` keyframe), KB 인사이트 카드 상단 정렬([ChatView](src/components/chat/ChatView.tsx)). lint·build PASS. **이전**: **데모 UI 폴리시 일괄**: (1) 탭 단일화 — [tabs.tsx](src/components/ui/tabs.tsx) `folder`(폴더형)·`chip`(필터칩) variant 추가 + 공용 [FolderTabs](src/components/folders/FolderTabs.tsx) → 문서함·에이전트·KB 적용. (2) 문서함 **"새 문서함 만들기"**([NewFolderButton](src/components/docs/NewFolderButton.tsx), 세션 한정·생성 즉시 탭 전환) + 한글 IME Enter 중복 버그 수정. (3) **설정 페이지 06 레이아웃**(2열, 토글스위치·세그먼트·모드카드, 헤더 테마토글 제거·ThemeToggle.tsx 삭제). (4) **KB 소스 삭제**(DELETE [/api/kb/sources/[id]](src/app/api/kb/sources/[id]/route.ts)·[SourceActions](src/components/kb/SourceActions.tsx)) + URL 흰배경·"관리"(표시전용) 버튼. (5) 토글 버튼 chip 스타일 통일(미선택 흰배경, 선택 primary). (6) 타이틀↔컨텐츠 여백 `mb-8` 통일, 에이전트 우측 카드 상단 정렬. lint·build PASS. 상세는 Plan 16장 2026-06-08 두 항목. **보류**: 지연 생성·소스↔문서함 매핑·문서템플릿/Email 알림 영속화는 프로덕션) |
| **블로커** | (없음) |

상세 체크박스는 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 15장에 있다. 본 표는 그 헤더만 옮긴 것이라고 생각하면 된다.

---

## 3. 핵심 결정 (요약)

| 영역 | 선택 |
|---|---|
| 프론트 | Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui |
| 인증 | Auth.js v5 + Google OAuth + `pentasecurity.com` 도메인 화이트리스트 |
| DB / Storage | **Supabase** (Postgres 15 + pgvector + Storage) |
| ORM | Drizzle (`postgres-js`, `prepare: false` 필수) |
| LLM | `@anthropic-ai/sdk` 직접 호출 — Sonnet 4.6 기본, Opus 4.7 보조, Prompt caching 적극 |
| 임베딩 | Voyage AI `voyage-3` (1024차원) |
| 백그라운드 | Inngest (에이전트 5단계 루프와 1:1 매핑) |
| 실시간 | Server-Sent Events |
| PPT | 자체 React `<Deck>` 미리보기 + `pptxgenjs` 다운로드. Figma는 디자인 토큰 공급원 |
| 알림 | Slack Web API + Resend |
| 배포 | Vercel + Supabase + Inngest |

결정 이유와 비교는 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 16장 참조.

---

## 4. 작업 워크플로우 — 매번 따를 것

### 세부 항목 완료 시
1. [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 15장에서 해당 줄의 `- [ ]` 을 `- [x]` 로 변경.
2. 같은 Phase 안의 "**검증**" 항목까지 모두 ✅이면 그 Phase 는 완료된 것이다.

### Phase 가 완료되면
1. Plan 15장 해당 Phase 헤더의 상태 라벨을 갱신:
   - 미시작: `⬜` → 진행 중: `🟡` → 완료: `✅`
2. 본 CLAUDE.md **2. 현재 진행 상태** 표를 갱신:
   - `활성 Phase` 를 다음 Phase 로
   - `완료 Phase` 에 직전 Phase 번호 append
   - `다음 액션` 한 줄 갱신
   - `마지막 갱신` 날짜 갱신

### CLAUDE.md 자체를 갱신해야 하는 경우
다음 중 하나라도 발생하면 본 파일도 함께 갱신한다:
- **새 명령어/스크립트** 가 안정화되어 자주 쓰일 때 → **6. 유용한 명령어** 추가
- **큰 결정이 바뀔 때** (스택 교체, 인증 방식 변경 등) → **3. 핵심 결정** 갱신 + Plan 16장 결정 로그에 1줄 추가
- **새로운 함정** 을 발견했을 때 → **8. 알려진 함정** 추가
- **블로커가 생기거나 해소될 때** → **2. 현재 진행 상태** 의 `블로커` 행 갱신

> 본 CLAUDE.md 는 **요약 + 인덱스** 역할이다. 상세 내용/긴 설명은 IMPLEMENTATION_PLAN.md 또는 코드 주석으로 가고, 여기엔 "Claude 가 매번 빠르게 읽을 30초짜리 컨텍스트" 만 남긴다.

### 커밋 방침 (사용자가 명시 요청 시에만 커밋)
- Phase 단위 또는 검증 통과 단위로 묶어 커밋
- 메시지 예: `phase2: KB URL crawl pipeline`, `phase4: pptx export with brand tokens`

---

## 5. 코딩 규칙

- 디렉토리 구조: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 6장(App Router)·7장(src/) 그대로 따른다.
- **모든 DB 쿼리는 `workspace_id` 로 격리**. `src/lib/rbac.ts` 헬퍼 사용.
- LLM 호출은 시스템 프롬프트·KB 컨텍스트에 `cache_control: { type: 'ephemeral' }` 명시.
- pptxgenjs·pdf-parse·jsdom 등 Node API 의존 라우트는 `export const runtime = 'nodejs'` 강제 (Edge X).
- Supabase pooler 연결은 `postgres()` 옵션 `prepare: false`. 마이그레이션만 Direct URL 사용.
- 파일/라인 참조는 마크다운 링크로: `[file.ts:42](src/path/to/file.ts#L42)`
- 코드에 주석은 기본적으로 쓰지 않는다. "왜 그렇게 했는가" 가 코드만 봐서는 알 수 없을 때만 짧게 한 줄.
- 이모지·문서 자동 생성 금지. 사용자가 요청할 때만.
- **디자인 토큰 단일 출처**:
  - **PPT (확정)**: [src/design/tokens.ppt.json](src/design/tokens.ppt.json) + [src/lib/ppt/layouts.ts](src/lib/ppt/layouts.ts). 슬라이드 코드에 hex·좌표 직접 박지 말 것. 9종 마스터 사양은 [docs/PPT_LAYOUT_SPEC.md](docs/PPT_LAYOUT_SPEC.md).
  - **웹 UI**: Phase 1–7 은 **shadcn 기본 + Tailwind 기본 토큰**으로 *기능 우선*. Phase 8 에서 [docs/DESIGN.md](docs/DESIGN.md) 기반 `src/design/tokens.web.json` + Tailwind preset 을 일괄 적용. **Phase 1–7 작업 중에도 hex 직접 박기 금지** — 나중 일괄 교체 비용을 위해 shadcn 변수만 사용.

---

## 6. 유용한 명령어

```bash
pnpm dev                  # Next.js 개발 서버
pnpm build                # 프로덕션 빌드
pnpm lint                 # ESLint

pnpm db:generate          # 스키마 → 마이그레이션 SQL 생성 (drizzle/)
pnpm db:migrate           # 마이그레이션 DB 적용 (Pooler URL + prepare:false)
pnpm db:studio            # Drizzle Studio (스키마/데이터 GUI)
pnpm db:seed              # "Penta Security" 워크스페이스 시드

pnpm verify:kb-url [url]  # URL → ready 까지 e2e 검증 (기본: WAPPLES)
pnpm verify:kb-file <url> # 공개 파일 URL 다운로드 → Storage 업로드 → ready 까지 e2e
pnpm verify:agent         # 자율 루프 e2e: forced content_hash → 5단계 event + 승인 + published (자급식·오프라인)
pnpm demo:pending         # KEEP_PENDING=1 force-change: 5단계 후 자동승인 생략 → 대기 카드 유지 (문서발행=수동 전제)

pnpm seed:demo            # 데모 KB 시드: WAPPLES URL + 파일 소스(DEMO_FILES 배열). 멱등. dev+inngest 필요
pnpm warmup               # 발표 ~10분 전 콜드스타트 워밍: DB·Anthropic·Voyage·Inngest 핑 1회

# 로컬 dev 동시 실행 (KB / agent 워커 동작 확인 시) — 반드시 2개 터미널
# 터미널 1:  INNGEST_DEV=1 pnpm dev
# 터미널 2:  pnpm inngest          # = inngest-cli@latest dev -u http://localhost:3000/api/inngest
#   (bare `inngest-cli` 는 전역 설치 안 돼 command not found → pnpm 스크립트 또는 npx 로 실행)
```

---

## 7. 환경 변수 (요약)

전체 목록과 발급 방법은 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 12장·15장 Phase 0.

핵심 그룹: **Auth (Google + AUTH_SECRET) · Supabase (URL/Anon/ServiceRole/DB URL 2종/Bucket 2종) · Anthropic · Voyage · Inngest · Slack · Resend · Sentry**.

---

## 8. 알려진 함정

- **Supabase pooler + `prepare: true`** → prepared statement 충돌. `prepare: false` 항상.
- **Supabase Direct URL 은 IPv6-only (Free tier)** → IPv4-only 환경에서 `db.<ref>.supabase.co` ENOTFOUND. 해결: 마이그레이션도 Pooler URL (aws-X-<region>.pooler.supabase.com) + `prepare: false` + `max: 1`. `drizzle-kit migrate` 는 URL 옵션이 제한적이라 [scripts/migrate.ts](scripts/migrate.ts) (drizzle-orm/postgres-js/migrator 직접 호출) 로 우회. `pnpm db:migrate` 가 이 방식.
- **`vector` 확장은 `pg_available_extensions` 에 있어도 활성화 별도** → `CREATE EXTENSION vector;` 안 하면 `type "vector" does not exist`. 0000 마이그레이션 맨 위에 `CREATE EXTENSION IF NOT EXISTS vector;` 박아둠.
- **pgvector 차원 불일치** → 임베딩 모델(voyage-3=1024) 과 컬럼 차원이 다르면 insert 시 에러. 모델 교체 시 마이그레이션 필수.
- **Supabase Data API public 스키마 기본 노출 종료 (2026-10-30 부터)** → 그날 이후 신규 테이블은 `anon/authenticated/service_role` GRANT 없으면 PostgREST/GraphQL/supabase-js `.from()` 으로 접근 불가. **DocMind 는 영향 없음** (DB 데이터는 Drizzle + postgres-js 직결만 사용, supabase-js 는 Storage 전용). **규칙: `supabase.from()/.rpc()` (Data API) 호출 금지** — 데이터 쿼리는 Drizzle, 파일은 `supabase.storage.from()` 만. 가이드: [github.com/orgs/supabase/discussions/45329](https://github.com/orgs/supabase/discussions/45329).
- **Google 도메인 검증** → `profile.email` 로 하면 우회 가능. **반드시 `profile.hd === 'pentasecurity.com'`** 검증.
- **Inngest step 미사용** → `step.run("name", async () => ...)` 로 감싸지 않으면 한 step 실패가 전체 재시도로 번진다.
- **Inngest v4 `createFunction` 시그니처** → v3 의 3-인자(`(opts, trigger, handler)`) 가 아니라 **2-인자(`(opts, handler)`)** 다. trigger 는 `opts.triggers: [{ event: "..." }]` 배열로 들어간다. 3-인자로 쓰면 `TS2554: Expected 2 arguments, but got 3` + handler 의 `event/step` 가 `any` 가 된다.
- **Inngest v4 `onFailure` 의 원본 페이로드 경로** → `({ event, error }) => ...` 에서 원본 이벤트는 `event.data.event.data` (NOT `event.data`). `event.data` 는 `{ function_id, run_id, error, event: <원본 페이로드> }` 인 wrapper 다.
- **Inngest dev 모드 활성화 = `INNGEST_DEV=1`** → v4 SDK 는 기본적으로 cloud 모드(시그니처 검증). 로컬에서 `inngest-cli dev` 를 쓰려면 Next 앱과 SDK send 양쪽 모두 `INNGEST_DEV=1` 가 env 에 있어야 한다. 안 그러면 (a) `/api/inngest` 가 `Signature validation failed` 로 401, (b) `inngest.send()` 가 cloud 로 흘러서 dev 서버는 이벤트를 못 본다. **반드시 `INNGEST_DEV=1 pnpm dev`** 로 띄울 것. 스크립트도 같은 env 로. **(2026-06-02 관찰)** Next 16 은 요청을 처리하는 `next-server` 를 별도 워커 프로세스로 띄우는데, 셸에서 앞에 붙인 `INNGEST_DEV=1` 이 그 워커까지 전파되지 않는 경우가 있다 (부모 `pnpm dev` 프로세스엔 있는데 `next-server` env 엔 없음 → `inngest.send()` 가 여전히 cloud 모드 → dev 서버 이벤트 0건, 소스가 `crawling` 에서 무한 정체. 증상 진단: `curl localhost:8288/v1/events` 가 빈 배열). **확실하게 하려면 `.env.local` 에 `INNGEST_DEV=1` 을 넣어** Next 가 런타임에 모든 워커로 주입하게 한다.
- **ES import hoist vs env 초기화** → `db/client.ts` 처럼 import 시점에 `process.env.X` 를 검증/사용하는 모듈을 스크립트에서 import 할 때, 같은 파일 안의 `dotenv.config()` 호출은 hoist 된 import 이후에 실행되므로 무용지물이다. 해결: **Node 22 의 `tsx --env-file=.env.local script.ts`** 사용 (Node 가 인터프리터 시작 전 .env 적용). `INNGEST_DEV` 등도 같은 이유로 `npm run` script 의 명령 앞부분에 박는다 (`INNGEST_DEV=1 tsx ...`).
- **Supabase Storage 키 클라이언트 생성** → 클라가 키 이름 정하면 덮어쓰기 공격 가능. 서버에서 `${workspaceId}/${ulid()}/${safeName}` 강제.
- **콜드스타트 (Supabase 는 없지만 LLM·Inngest 는 첫 호출 지연)** → 데모 10분 전 warmup ping 1회.
- **한글 폰트 미임베딩** → .pptx 가 시청자 PC 에서 글자 깨짐. 발표 PC 의 PowerPoint 기본 폰트 (`맑은 고딕`) 로 디자인 토큰 강제 또는 pptxgenjs `embedFonts` 검토.
- **Next.js 16: `middleware` 파일 컨벤션 deprecated → `proxy` 로 변경 예정** → 현재 dev 시작 시 경고 출력 (동작은 정상). 또한 v16 은 middleware export 형태에 더 엄격 — `export const { auth: middleware } = NextAuth(...)` destructure 형태를 인식 못함. **반드시 default export 한 function** (`export default auth;`) 또는 named `middleware` 함수 export. 향후 Next 가 `proxy` 로 강제 전환 시 파일명·export 명 둘 다 갱신 필요.
- **Auth.js v5 + Edge middleware + database session** → middleware 는 Edge runtime 이라 DB 접근 불가. 해결: [src/auth.config.ts](src/auth.config.ts) (Edge-safe, JWT session strategy) 와 [src/auth.ts](src/auth.ts) (Node, DrizzleAdapter) 분리. middleware 는 config 만 import.
- **`@sentry/wizard` 기본 `sendDefaultPii: true`** → 이메일/IP 등 PII 가 Sentry 로 그대로 전송. plan §10 ("PII 는 로그에 남기지 않음") 정면 위반. wizard 실행 후 [sentry.server.config.ts](sentry.server.config.ts), [sentry.edge.config.ts](sentry.edge.config.ts), [src/instrumentation-client.ts](src/instrumentation-client.ts) **3 파일 모두 `false` 로 강제 변경**. 특정 컨텍스트에서만 사용자 식별 필요하면 `beforeSend` 로 명시적 화이트리스트.
- **pnpm 11 `allowBuilds` placeholder** → 새 native-binary 의존성 (`sharp`, `unrs-resolver`, `esbuild`, `@sentry/cli` 등) 추가 시 [pnpm-workspace.yaml](pnpm-workspace.yaml) 의 `allowBuilds:` 에 `set this to true or false` placeholder 가 자동 추가됨. 이 상태로 `pnpm install` 실행 시 exit 1 로 중단. 해결: 각 패키지를 `true` (build 허용) 또는 `false` (스킵) 로 명시 후 재실행.
- **voyageai SDK 의 깨진 ESM 빌드** → `voyageai@0.2.1` 의 `package.json` 이 `module: dist/esm/index.mjs` 를 가리키지만 그 파일이 `'../local'`·`'./ExtendedClient'` 같은 존재하지 않는 경로를 import 한다. Next 16 (Turbopack) production build 가 ESM 우선 해석 → `ERR_UNSUPPORTED_DIR_IMPORT`. `serverExternalPackages` 로도 우회 안됨. **해결: SDK 제거하고 [src/lib/embeddings.ts](src/lib/embeddings.ts) 에서 `https://api.voyageai.com/v1/embeddings` 를 fetch 로 직접 호출**. 향후 SDK 가 고쳐지면 되돌릴 수 있음.
- **Node 전용 native 의존성과 Next 16 번들링** → `pdf-parse` (pdfjs-dist 래퍼) 는 Next 가 ESM 으로 번들하려 하면 빌드/런타임 실패. [next.config.ts](next.config.ts) 의 `serverExternalPackages: ["pdf-parse"]` 에 추가해 Node `require` 로 로드되게 한다. 새 native-만-가능 패키지 추가 시 동일 처리.
- **`jsdom` 은 Vercel 런타임에서 `ERR_REQUIRE_ESM` 으로 죽는다 → `linkedom` 사용** → jsdom 의 transitive 의존성 `html-encoding-sniffer@6`(+`@exodus/bytes`) 가 ESM-only 인데, `serverExternalPackages` 로 externalize 하면 Vercel 이 `require()` 로 로드하려다 `ERR_REQUIRE_ESM` 으로 `/api/inngest` 가 import 단계에서 크래시(로컬 dev 는 해석 방식이 달라 통과 — 배포 후에야 드러남). **해결: jsdom 제거, [html.ts](src/lib/crawler/html.ts) 의 Readability DOM 을 `linkedom` `parseHTML` 로 공급**(`new Readability(document)`). cheerio 는 DOM 스펙이 아니라 Readability 에 못 넘기므로 대체 불가. linkedom 은 번들 친화적이라 `serverExternalPackages` 에 넣지 않는다.
- **`<html>` hydration mismatch (`data-hwp-extension` 등)** → 서버 HTML 엔 없고 클라엔 있는 속성 경고는 **브라우저 확장프로그램**이 React 로드 전 `<html>` 에 주입한 것(앱 버그 아님). 동반되는 `message channel closed before a response` 도 확장 메시징 노이즈. 시크릿 창이면 사라짐. 완화: [src/app/layout.tsx](src/app/layout.tsx) `<html suppressHydrationWarning>` (해당 요소 속성만 무시, 자식 검사는 유지).
- **Voyage 무료 티어 = 3 RPM / 10K TPM** → 결제수단 미등록 시 분당 3 호출 한도. 인터뷰 5문답 + KB 매칭 + generate(11+ 호출) 가 1~2분에 몰리면 즉시 429 (`voyage 429: You have not yet added your payment method ...`). **영구 해결**: [dashboard.voyageai.com](https://dashboard.voyageai.com) 에서 결제수단 등록 → 표준 limit 으로 자동 복구. **앱 측 방어**: (a) [src/lib/embeddings.ts](src/lib/embeddings.ts) 가 query embedding 을 process-level Map cache (256 entry LRU) + 429 시 25s 대기 후 1회 재시도, (b) 인터뷰 turn 은 `sources` step + 초기 SSR 에서만 KB 매칭 (다른 turn 은 직전 매칭을 store 가 유지), (c) generate 는 모든 slide-fill query 를 단일 batched `embed()` 호출로 묶음. 총 호출 수 17 → 4 (75% 절감).
- **Tailwind v4 `@theme` 의 `--spacing-<name>` 이 내장 사이즈 스케일을 가림** → `@theme` 에 `--spacing-sm/md/lg/xl` 같은 **t-shirt 명명 키**를 추가하면 `max-w-sm`·`w-md`·`max-w-lg` 등 사이징 유틸이 `--container-*`(24rem 등) 대신 그 spacing 값(12px 등)으로 인라인된다. 증상: `max-w-sm` 쓴 요소(로그인 카드·Dialog·Sheet·SourceSheet·DropZone)가 12~16px 로 collapse — 배경/보더 없으면 안 보이다가 카드 배경 넣는 순간 드러남. **해결: 명명형 `--spacing-*` 토큰을 두지 말 것.** DESIGN 간격(4·8·12·16·24·32·48·64px)은 Tailwind 기본 숫자 스케일(`p-1/2/3/4/6/8/12/16`)과 1:1 이라 명명 토큰이 불필요. (Phase 8 step1 에서 넣었다가 제거함 — [globals.css](src/app/globals.css))
- **한글 IME 조합 중 Enter = 입력 제출 핸들러 중복 발동** → 한글 입력 시 마지막 글자(예 "서")를 조합 확정하려고 누른 Enter 가 `isComposing=true` 상태로 `onKeyDown` 을 발동시켜, 조합 확정 + 실제 제출이 겹치며 **마지막 글자로 항목이 하나 더 생성**된다(폴더·태그·검색어 등). **규칙: Enter 제출 핸들러는 `if (e.key === "Enter" && !e.nativeEvent.isComposing)` 로 조합 중 Enter 를 무시**. 적용처: [NewFolderButton](src/components/docs/NewFolderButton.tsx), [FolderPickerDialog](src/components/home/FolderPickerDialog.tsx). 새 Enter-제출 입력 추가 시 동일 가드 필수.
- **shadcn 변형 토큰은 `group-data-[variant=X]/tabs-list:` 선택자로 base 를 이겨라** → [tabs.tsx](src/components/ui/tabs.tsx) 처럼 cva base 문자열에 `data-active:bg-background` 같은 기본값이 있을 때, 인라인 `className` 의 `data-active:bg-primary`(낮은 특이성)는 다크모드 base 오버라이드(`dark:data-active:bg-input/30`)를 못 이긴다. 새 탭 스타일은 **인라인 override 말고 변형(variant)으로** 추가해 group-data 선택자 특이성으로 base 를 덮을 것(pill/folder/chip 이 이 패턴). `cn` 은 twMerge 라 단순 충돌은 합쳐주지만 dark: modifier 가 붙은 base 는 합쳐지지 않음.
- **서버 컴포넌트 렌더 본문에서 `Date.now()`/`Math.random()` 금지** → React 순수성 린트(`Cannot call impure function during render`)가 에러로 막는다. 시간 기준 플래그(예 문서함 "New/Update" 24h 판정)는 **DB 에서 `now() - interval '24 hours'` 로 계산**(SQL boolean)하거나 헬퍼/이벤트 핸들러로 빼라. ([docs/page.tsx](src/app/(app)/docs/page.tsx) 에서 SQL 로 해결).
- **카드 표면 전체 클릭 + 내부 버튼 공존** → 카드를 `<a>`/버튼으로 통째 감싸면 내부 버튼이 중첩 인터랙티브(유효하지 않은 HTML)가 된다. 패턴: 카드 컨테이너 `relative` + `absolute inset-0` 오버레이 `<Link>`(z-0)로 표면 클릭을 받고, 내부 액션은 `relative z-10`. 텍스트 영역은 `pointer-events-none`, 버튼만 `pointer-events-auto` 로 클릭 분리([VersionCard](src/components/docs/VersionCard.tsx)·[kb/page](src/app/(app)/kb/page.tsx) hover 액션).
- **SVG 노드 다이어그램의 반투명 fill + 관통선** → [LoopDiagram](src/components/agent/LoopDiagram.tsx)처럼 노드 중심을 잇는 선 위에 노드 원을 그릴 때, 원 fill 에 투명도(`/60` 등)가 있으면 선이 비친다. 상태별 명암 위계를 유지하려면 **노드마다 불투명 백드롭 원(배경색 `text-canvas`)을 먼저 깔고** 그 위에 상태 원을 올린다.
- **PPT 푸터(하단바)는 슬라이드 kind별로 배경색이 다르다** → 단일 `bar.fill` 이 아니라 [layouts.ts](src/lib/ppt/layouts.ts) `footerBarFill(kind)`(agenda `#F2F2F2`·section `#D9D9D9`·나머지 `#000000`) 로 결정. **검정 바일 때만**(`footerIsDarkBar`) 보안칩은 `_dark` 변형(`assetPath(key, lv, { dark:true })` → `security_level_N_dark.png`), 로고는 `penta_white_small.png`(토큰 `pentaWhiteSmall`). 밝은 바는 non-dark 보안칩 + `penta_black_small`. 색·에셋 추가 시 [render.tsx](src/lib/ppt/render.tsx) `FooterMaster`·[pptx.ts](src/lib/ppt/pptx.ts) `applyFooter` **둘 다** 갱신(미리보기/다운로드 정합). hex 직접 박지 말고 tokens `footerMaster.body.barFill` 에 추가.
- **section 슬라이드는 풀버전(lengthPages≥16)만 생성** → Plan A 기본 흐름은 section 없음(agenda=토픽 제목). 16장+면 [generate.ts](src/lib/ppt/generate.ts)가 플래너 `sectionTitles`로 토픽을 그룹화해 디바이더 삽입. section 은 quote 처럼 **목차 미포함·흐름 전용**(agenda 정합 불변). 데모 10장은 section 0개.
- **문서 제목 출처 3원화** → 한 문서의 제목이 세 군데서 나온다: (a) `documents.title` (문서함 카드·상세), (b) `deck.meta.title` (미리보기 헤더·pptx `pres.title`), (c) `deck.slides[0].title` (PPT 표지 텍스트 — LLM 이 생성하는 풍부한 제목). 손대지 않으면 (a)(b)=placeholder, (c)=풍부한 제목으로 어긋난다. **통일 규칙**: [generate.ts](src/lib/ppt/generate.ts) 가 `meta.title = 표지(첫 슬라이드) 제목` 으로 맞추고(→(b) 해결), 생성 라우트가 `documents.title` 도 표지 제목으로 동기화(→(a) 해결). **Mode A 실제 생성 경로는 [api/interview/finalize](src/app/api/interview/finalize/route.ts)** 다 (`/api/generate` 는 재생성 경로) — 동기화를 한쪽만 넣으면 카드 제목이 안 바뀌니 **양쪽 모두**에 넣을 것.

---

## 9. 데모 시나리오 (라이브 발표)

1. **Demo A** — 홈에서 "영업 제안서" 카드 → 5문답(독자=임원·CTA=계약·반론=가격·핵심메시지="WAPPLES로 웹 위협 선제 차단"·분량=10) → 30초 내 미리보기 + `.pptx` 다운로드.
2. **Demo B** — `scripts/force-change.ts` 로 시드 URL 강제 변경 → 활동 피드에 `감지→인식→판단→행동→학습` 5단계 자동 진행 → 우측 승인 카드 → 발행 승인 → Slack `#docmind-demo` 알림.

백업: `/demo/playback` 라우트에서 사전 녹화본 재생.

---

**핵심 한 줄**: 새 대화면 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 먼저, 작업 끝나면 그 파일의 체크박스부터 갱신, Phase 가 끝나면 이 CLAUDE.md 2 번 섹션도 갱신.
