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

---

## 2. 현재 진행 상태

> 작업이 끝날 때마다 이 섹션을 갱신할 것. 한 줄짜리 "어디까지 왔나" 가 항상 최신이어야 한다.

| 항목 | 값 |
|---|---|
| **활성 Phase** | Phase 8 — UI 디자인 시스템 적용 ([docs/DESIGN.md](docs/DESIGN.md)) |
| **완료 Phase** | Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7 |
| **다음 액션** | [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 15장 Phase 8 — `tokens.web.json` + `tailwind-preset.ts` + `globals.css`(:root/.dark) + Pretendard, shadcn 컴포넌트 토큰 매핑, 화면별 DESIGN.md 적용, 다크모드. **전제**: Phase 1–7 모든 화면이 shadcn 기본으로 기능 동작 중 → 토큰 일괄 적용. **주의**: ActivityFeed/LoopDiagram phase 색([phases.ts](src/components/agent/phases.ts))은 Tailwind 팔레트 → brand spectrum 으로 remap 필요 |
| **마지막 갱신** | 2026-06-01 (Phase 7 ✅ 전체 완료 — (5) 설정: `/settings`(에이전트 정책 auto_run/publish + Slack 채널, monitor `config_json` 저장)·이메일 수신자·브랜드 템플릿(읽기)·연결 배지 + `/api/settings` PATCH. `act` 가 `getNotifyChannel`/`shouldAutoPublish` 로 설정 반영. roundtrip 검증 PASS, nav 설정 링크. Phase 7 (1)~(5) 모두 ✅, 실시간 1초·승인 시각 e2e 만 브라우저 1회 잔여) |
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
- **Inngest dev 모드 활성화 = `INNGEST_DEV=1`** → v4 SDK 는 기본적으로 cloud 모드(시그니처 검증). 로컬에서 `inngest-cli dev` 를 쓰려면 Next 앱과 SDK send 양쪽 모두 `INNGEST_DEV=1` 가 env 에 있어야 한다. 안 그러면 (a) `/api/inngest` 가 `Signature validation failed` 로 401, (b) `inngest.send()` 가 cloud 로 흘러서 dev 서버는 이벤트를 못 본다. **반드시 `INNGEST_DEV=1 pnpm dev`** 로 띄울 것. 스크립트도 같은 env 로.
- **ES import hoist vs env 초기화** → `db/client.ts` 처럼 import 시점에 `process.env.X` 를 검증/사용하는 모듈을 스크립트에서 import 할 때, 같은 파일 안의 `dotenv.config()` 호출은 hoist 된 import 이후에 실행되므로 무용지물이다. 해결: **Node 22 의 `tsx --env-file=.env.local script.ts`** 사용 (Node 가 인터프리터 시작 전 .env 적용). `INNGEST_DEV` 등도 같은 이유로 `npm run` script 의 명령 앞부분에 박는다 (`INNGEST_DEV=1 tsx ...`).
- **Supabase Storage 키 클라이언트 생성** → 클라가 키 이름 정하면 덮어쓰기 공격 가능. 서버에서 `${workspaceId}/${ulid()}/${safeName}` 강제.
- **콜드스타트 (Supabase 는 없지만 LLM·Inngest 는 첫 호출 지연)** → 데모 10분 전 warmup ping 1회.
- **한글 폰트 미임베딩** → .pptx 가 시청자 PC 에서 글자 깨짐. 발표 PC 의 PowerPoint 기본 폰트 (`맑은 고딕`) 로 디자인 토큰 강제 또는 pptxgenjs `embedFonts` 검토.
- **Next.js 16: `middleware` 파일 컨벤션 deprecated → `proxy` 로 변경 예정** → 현재 dev 시작 시 경고 출력 (동작은 정상). 또한 v16 은 middleware export 형태에 더 엄격 — `export const { auth: middleware } = NextAuth(...)` destructure 형태를 인식 못함. **반드시 default export 한 function** (`export default auth;`) 또는 named `middleware` 함수 export. 향후 Next 가 `proxy` 로 강제 전환 시 파일명·export 명 둘 다 갱신 필요.
- **Auth.js v5 + Edge middleware + database session** → middleware 는 Edge runtime 이라 DB 접근 불가. 해결: [src/auth.config.ts](src/auth.config.ts) (Edge-safe, JWT session strategy) 와 [src/auth.ts](src/auth.ts) (Node, DrizzleAdapter) 분리. middleware 는 config 만 import.
- **`@sentry/wizard` 기본 `sendDefaultPii: true`** → 이메일/IP 등 PII 가 Sentry 로 그대로 전송. plan §10 ("PII 는 로그에 남기지 않음") 정면 위반. wizard 실행 후 [sentry.server.config.ts](sentry.server.config.ts), [sentry.edge.config.ts](sentry.edge.config.ts), [src/instrumentation-client.ts](src/instrumentation-client.ts) **3 파일 모두 `false` 로 강제 변경**. 특정 컨텍스트에서만 사용자 식별 필요하면 `beforeSend` 로 명시적 화이트리스트.
- **pnpm 11 `allowBuilds` placeholder** → 새 native-binary 의존성 (`sharp`, `unrs-resolver`, `esbuild`, `@sentry/cli` 등) 추가 시 [pnpm-workspace.yaml](pnpm-workspace.yaml) 의 `allowBuilds:` 에 `set this to true or false` placeholder 가 자동 추가됨. 이 상태로 `pnpm install` 실행 시 exit 1 로 중단. 해결: 각 패키지를 `true` (build 허용) 또는 `false` (스킵) 로 명시 후 재실행.
- **voyageai SDK 의 깨진 ESM 빌드** → `voyageai@0.2.1` 의 `package.json` 이 `module: dist/esm/index.mjs` 를 가리키지만 그 파일이 `'../local'`·`'./ExtendedClient'` 같은 존재하지 않는 경로를 import 한다. Next 16 (Turbopack) production build 가 ESM 우선 해석 → `ERR_UNSUPPORTED_DIR_IMPORT`. `serverExternalPackages` 로도 우회 안됨. **해결: SDK 제거하고 [src/lib/embeddings.ts](src/lib/embeddings.ts) 에서 `https://api.voyageai.com/v1/embeddings` 를 fetch 로 직접 호출**. 향후 SDK 가 고쳐지면 되돌릴 수 있음.
- **Node 전용 native 의존성과 Next 16 번들링** → `pdf-parse` (pdfjs-dist 래퍼), `jsdom` 등은 Next 가 ESM 으로 번들하려 하면 빌드/런타임 실패. [next.config.ts](next.config.ts) 의 `serverExternalPackages: ["pdf-parse", "jsdom"]` 에 추가해 Node `require` 로 두 번 다 로드되게 한다. 새 native-만-가능 패키지 추가 시 동일 처리.
- **`<html>` hydration mismatch (`data-hwp-extension` 등)** → 서버 HTML 엔 없고 클라엔 있는 속성 경고는 **브라우저 확장프로그램**이 React 로드 전 `<html>` 에 주입한 것(앱 버그 아님). 동반되는 `message channel closed before a response` 도 확장 메시징 노이즈. 시크릿 창이면 사라짐. 완화: [src/app/layout.tsx](src/app/layout.tsx) `<html suppressHydrationWarning>` (해당 요소 속성만 무시, 자식 검사는 유지).
- **Voyage 무료 티어 = 3 RPM / 10K TPM** → 결제수단 미등록 시 분당 3 호출 한도. 인터뷰 5문답 + KB 매칭 + generate(11+ 호출) 가 1~2분에 몰리면 즉시 429 (`voyage 429: You have not yet added your payment method ...`). **영구 해결**: [dashboard.voyageai.com](https://dashboard.voyageai.com) 에서 결제수단 등록 → 표준 limit 으로 자동 복구. **앱 측 방어**: (a) [src/lib/embeddings.ts](src/lib/embeddings.ts) 가 query embedding 을 process-level Map cache (256 entry LRU) + 429 시 25s 대기 후 1회 재시도, (b) 인터뷰 turn 은 `sources` step + 초기 SSR 에서만 KB 매칭 (다른 turn 은 직전 매칭을 store 가 유지), (c) generate 는 모든 slide-fill query 를 단일 batched `embed()` 호출로 묶음. 총 호출 수 17 → 4 (75% 절감).

---

## 9. 데모 시나리오 (라이브 발표)

1. **Demo A** — 홈에서 "영업 제안서" 카드 → 5문답(독자=임원·CTA=계약·반론=가격·소스=WAPPLES·분량=10) → 30초 내 미리보기 + `.pptx` 다운로드.
2. **Demo B** — `scripts/force-change.ts` 로 시드 URL 강제 변경 → 활동 피드에 `감지→인식→판단→행동→학습` 5단계 자동 진행 → 우측 승인 카드 → 발행 승인 → Slack `#docmind-demo` 알림.

백업: `/demo/playback` 라우트에서 사전 녹화본 재생.

---

**핵심 한 줄**: 새 대화면 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 먼저, 작업 끝나면 그 파일의 체크박스부터 갱신, Phase 가 끝나면 이 CLAUDE.md 2 번 섹션도 갱신.
