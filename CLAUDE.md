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
| **활성 Phase** | Phase 1 — 레포 부트스트랩 & 인증 기반 |
| **완료 Phase** | Phase 0 (외부 의존성·키 확보) |
| **다음 액션** | Sentry 잔여만 남음. `SENTRY_DSN` 발급 후 wizard 적용 → Phase 1 완료. 발급 전이면 **Phase 2 (KB) 선행** 가능 |
| **마지막 갱신** | 2026-05-28 (Phase 1 검증 #2·#3 통과 — signIn 5/5 + DOC_TYPES 6개. Sentry 만 잔여) |
| **블로커** | `SENTRY_DSN` 미발급 → Phase 1 의 Sentry 항목 보류. 다른 작업 진행에는 영향 없음 |

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

# (Phase 2 이후 추가 예정)
# npx inngest-cli@latest dev  # 로컬 Inngest 대시보드
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
- **Supabase Storage 키 클라이언트 생성** → 클라가 키 이름 정하면 덮어쓰기 공격 가능. 서버에서 `${workspaceId}/${ulid()}/${safeName}` 강제.
- **콜드스타트 (Supabase 는 없지만 LLM·Inngest 는 첫 호출 지연)** → 데모 10분 전 warmup ping 1회.
- **한글 폰트 미임베딩** → .pptx 가 시청자 PC 에서 글자 깨짐. 발표 PC 의 PowerPoint 기본 폰트 (`맑은 고딕`) 로 디자인 토큰 강제 또는 pptxgenjs `embedFonts` 검토.
- **Next.js 16: `middleware` 파일 컨벤션 deprecated → `proxy` 로 변경 예정** → 현재 dev 시작 시 경고 출력 (동작은 정상). 또한 v16 은 middleware export 형태에 더 엄격 — `export const { auth: middleware } = NextAuth(...)` destructure 형태를 인식 못함. **반드시 default export 한 function** (`export default auth;`) 또는 named `middleware` 함수 export. 향후 Next 가 `proxy` 로 강제 전환 시 파일명·export 명 둘 다 갱신 필요.
- **Auth.js v5 + Edge middleware + database session** → middleware 는 Edge runtime 이라 DB 접근 불가. 해결: [src/auth.config.ts](src/auth.config.ts) (Edge-safe, JWT session strategy) 와 [src/auth.ts](src/auth.ts) (Node, DrizzleAdapter) 분리. middleware 는 config 만 import.

---

## 9. 데모 시나리오 (라이브 발표)

1. **Demo A** — 홈에서 "영업 제안서" 카드 → 5문답(독자=임원·CTA=계약·반론=가격·소스=WAPPLES·분량=10) → 30초 내 미리보기 + `.pptx` 다운로드.
2. **Demo B** — `scripts/force-change.ts` 로 시드 URL 강제 변경 → 활동 피드에 `감지→인식→판단→행동→학습` 5단계 자동 진행 → 우측 승인 카드 → 발행 승인 → Slack `#docmind-demo` 알림.

백업: `/demo/playback` 라우트에서 사전 녹화본 재생.

---

**핵심 한 줄**: 새 대화면 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 먼저, 작업 끝나면 그 파일의 체크박스부터 갱신, Phase 가 끝나면 이 CLAUDE.md 2 번 섹션도 갱신.
