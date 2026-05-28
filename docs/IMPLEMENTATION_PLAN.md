# DocMind Agent — 웹 서비스 구현 계획서

> 출처 기획서: [docs/DocMind*Agent*기획서.pdf](docs/DocMind_Agent_기획서.pdf)
> 대상 대회: AI Agent Hack 2026 · 펜타시큐리티 디자인팀
> 작성일: 2026-05-26 · 버전 0.1 (해커톤 제출 직전 구현용)

---

## 1. Context

펜타시큐리티 전직원이 겪는 반복적 문서 작업(이전 PPT 복붙, 부서별 품질 편차, 버전 혼란)을 해결하기 위해 기획된 **DocMind Agent**의 웹 구현체를 만든다. 핵심은 다음 세 가지가 한 화면에서 끝까지 흐른다는 점이다.

1. **지식 베이스** — 사내 URL·파일을 모아 AI가 학습할 원천을 만든다.
2. **5질문 대화 인터뷰** — 빈 화면이 아니라 질문에서 시작해 누구나 동일 품질의 문서 골격을 잡는다.
3. **에이전트 자율 루프 (감지→인식→판단→행동→학습)** — 사람이 트리거하지 않아도 소스 변경을 감지해 문서를 자동 갱신한다.

본 계획서는 위 세 축을 **Next.js App Router 단일 앱**으로 구현하기 위한 기술/도메인/마일스톤 청사진이다.

### 결정된 전제 (사용자 확인)

- **구현 수준**: 데모 우선 + 확장 여지 (해커샤 라이브 데모 = WAPPLES 시나리오 성공이 1차 목표, 멀티-워크스페이스/RBAC는 후속).
- **AI 호출**: `@anthropic-ai/sdk` 직접 호출 (Claude Sonnet 4.6 기본, 추론 무거운 단계는 Opus 4.7, 프롬프트 캐싱 적극).
- **PPT 생성**: 웹에서 React로 슬라이드 렌더 + 다운로드 시 `pptxgenjs`로 .pptx 변환. Figma는 디자인 토큰/템플릿 사양 공급원으로만 활용.
- **인증**: Auth.js v5 + Google OAuth + `pentasecurity.com` 도메인 화이트리스트.
- **6. 가격 정책 섹션은 구현 범위에서 제외**.

---

## 2. 기술 스택

| 영역              | 선택                                                                                                                                                     | 이유                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 프레임워크        | Next.js 16 (App Router) + TypeScript                                                                                                                     | Server Actions로 LLM/DB 호출을 백엔드에서 격리. 단일 배포.                          |
| UI                | Tailwind CSS + shadcn/ui + Radix Primitives                                                                                                              | 기획서의 4개 화면 빠른 조립, Figma 토큰을 CSS 변수로 매핑하기 쉬움.                 |
| 디자인 토큰       | Tailwind preset + CSS Variables                                                                                                                          | Figma 템플릿의 색/타이포/로고를 design-tokens 패키지로 단일 출처 관리.              |
| 인증              | Auth.js v5 (NextAuth) + Google Provider                                                                                                                  | 도메인 화이트리스트(`hd === 'pentasecurity.com'`)를 `signIn` 콜백에서 강제.         |
| DB                | PostgreSQL 15 (Supabase)                                                                                                                                 | 단일 DB로 OLTP + 벡터까지 처리. 콜드스타트 없음(라이브 데모 유리).                  |
| 벡터 검색         | **pgvector** 확장                                                                                                                                        | Supabase에 **기본 활성**, 별도 설치 불필요. 임베딩 저장/유사도 검색.                |
| ORM               | Drizzle ORM + drizzle-kit (`postgres-js`, `prepare: false`)                                                                                              | 마이그레이션 코드화, 타입 안전. Supavisor pooler와 호환.                            |
| 파일 스토리지     | **Supabase Storage** (S3 호환 + signed upload URL)                                                                                                       | DB와 같은 콘솔/프로젝트로 운영 단순. `createSignedUploadUrl`로 클라이언트 직업로드. |
| 백그라운드 작업   | **Inngest**                                                                                                                                              | Vercel 친화, 스텝별 재시도/관찰가능. 에이전트 5단계 루프와 매핑 직관적.             |
| 크롤링 / 파싱     | `undici` fetch + `cheerio` (HTML), `pdf-parse` (PDF), `mammoth` (DOCX), `xlsx` (XLSX), `pptx-parser`/JSZip (PPTX). JS-렌더 페이지는 Playwright fallback. | 기획서가 명시한 4가지 포맷 + URL 커버.                                              |
| 임베딩            | Voyage AI `voyage-3` (또는 OpenAI `text-embedding-3-large`)                                                                                              | Anthropic 권장 임베딩. 한국어 품질 우수.                                            |
| LLM               | Anthropic Claude Sonnet 4.6 (기본 대화·생성) / Opus 4.7 (영향분석·diff 판단)                                                                             | Prompt caching + tool use.                                                          |
| PPT 생성          | `pptxgenjs`                                                                                                                                              | 서버 사이드에서 .pptx 직생성, 디자인 토큰을 직접 주입.                              |
| 슬라이드 미리보기 | 자체 React `<Slide>` 컴포넌트셋                                                                                                                          | 미리보기와 pptx 출력이 같은 레이아웃 사양을 공유.                                   |
| 실시간 대시보드   | Server-Sent Events (Next.js Route Handler `text/event-stream`)                                                                                           | WebSocket 인프라 없이 활동 피드 스트림.                                             |
| 알림              | Slack Web API (`@slack/web-api`), Resend (이메일)                                                                                                        | 데모 핵심: Slack 알림.                                                              |
| 옵저버빌리티      | Sentry + Vercel Analytics + Inngest 대시보드                                                                                                             | 라이브 데모 디버깅.                                                                 |
| 배포              | Vercel (앱) + Supabase (DB + Storage) + Inngest (잡)                                                                                                     | 매니지드 콘솔 3개로 운영 단순.                                                      |

---

## 3. 전체 아키텍처

```
┌────────────────────────── Browser ──────────────────────────┐
│  Next.js App Router (RSC + Client Components)              │
│  shadcn/ui, Tailwind, Slide Renderer, SSE client           │
└──────┬───────────────────────────────────────┬──────────────┘
       │ Server Actions / Route Handlers       │ SSE stream
       ▼                                       ▼
┌──────────────── Next.js Server (Edge/Node) ────────────────┐
│  Auth.js · Drizzle · LLM Orchestrator · pptxgenjs          │
│  • /api/kb/*    URL 등록·크롤링·파일업로드                  │
│  • /api/interview/*  5질문 인터뷰 진행                       │
│  • /api/generate/*   PPT 생성/내보내기                        │
│  • /api/agent/*   루프 제어·승인 큐                          │
│  • /api/events/stream  활동 피드 SSE                         │
└──────┬─────────────┬──────────────┬──────────────┬──────────┘
       │             │              │              │
       ▼             ▼              ▼              ▼
   Supabase        Supabase     Anthropic       Inngest
   Postgres        Storage      Claude API     (백그라운드 잡)
   (+pgvector)     (원본/.pptx)
       │
       │  ┌────────── Inngest workers ──────────┐
       └─►│  source.detect (cron 30분)            │ Mode B/C
          │  source.crawl                         │ 감지
          │  doc.diff-analyze                     │ 인식
          │  doc.impact-rank                      │ 판단
          │  doc.update-and-notify (Slack/Resend) │ 행동
          │  pattern.learn (vector upsert)        │ 학습
          └────────────────────────────────────────┘
```

---

## 4. 도메인 모델 (Drizzle 스키마 개요)

> 파일: `src/db/schema.ts` (마이그레이션: `drizzle/`)

```ts
users            (id, email, name, image, role)              // Auth.js 표준
workspaces       (id, name, slack_team_id?)                  // 데모: 1개 시드
workspace_members(workspace_id, user_id, role)               // owner|editor|viewer

sources          (id, workspace_id, kind, url?, file_key?,
                  title, summary, tags[], status,
                  last_crawled_at, content_hash, fingerprint) // kind: 'url'|'file'
source_chunks    (id, source_id, ord, text, token_count,
                  embedding vector(1024))                     // pgvector

documents        (id, workspace_id, type, title, status,
                  reader, cta, objection, length_pages,
                  brand_template_id, created_by)              // type: 6종 카드값
document_versions(id, document_id, version, slides_json,
                  pptx_object_key?, created_by, change_note)
document_sources (document_id, source_id, importance)         // 연결관계

interview_sessions(id, document_id, current_step, answers_json)

agents           (id, workspace_id, kind, status, auto_run,
                  config_json)                                // kind: monitor|update|notify|generate
agent_runs       (id, agent_id, started_at, ended_at,
                  trigger, status, steps_json, summary)
agent_events     (id, run_id, ts, phase, type, payload_json)  // phase: detect|perceive|reason|act|learn

approvals        (id, run_id, document_id?, kind, payload, decided_by?, decision, decided_at)

schedules        (id, workspace_id, cron, document_template_json,
                  agent_id, enabled)                          // Mode C

brand_templates  (id, workspace_id, name, tokens_json,
                  cover_layout_id, slide_layouts_json)
notifications    (id, workspace_id, channel, target, payload,
                  status, related_run_id)
audit_logs       (id, workspace_id, actor_id, action, target, ts)
```

핵심 인덱스: `sources(workspace_id, status)`, `source_chunks USING ivfflat (embedding vector_cosine_ops)`, `agent_events(run_id, ts desc)`.

---

## 5. 기능별 구현 상세

### 5.1 인증 & 워크스페이스 부트스트랩

- `auth.ts`에 Auth.js v5 구성. Google Provider `authorization.params.hd = 'pentasecurity.com'`.
- `signIn` 콜백에서 `profile.email_verified === true && profile.hd === 'pentasecurity.com'` 검증, 아니면 거부.
- 첫 로그인 시 `users` upsert → 시드 워크스페이스(`"Penta Security"`) 멤버로 자동 가입.
- 미들웨어(`middleware.ts`): `/`, `/kb/*`, `/agent/*`, `/docs/*`는 인증 필요. `/login`만 공개.

### 5.2 지식 베이스 (Mode A·B 공통 원천)

**URL 등록 흐름** (`POST /api/kb/url`)

1. URL 유효성 검사 → `sources` insert (`status: 'crawling'`).
2. Inngest 이벤트 `source/crawl.requested` 발행.
3. 워커:
    - `undici` fetch → `Content-Type` 분기 (HTML/PDF/직접파일).
    - HTML: `cheerio`로 본문 추출(Mozilla Readability 휴리스틱). JS 렌더 필요 시 Playwright fallback.
    - 추출 텍스트를 500~800 토큰 청크로 분할.
    - 임베딩 배치 호출 → `source_chunks` 저장.
    - 전체 본문 SHA-256 → `sources.content_hash` (변경 감지용).
    - Claude로 `title/summary/tags[]` 생성 → `sources` 갱신, `status: 'ready'`.

**파일 업로드 흐름** (`POST /api/kb/upload`)

1. 클라이언트가 Supabase Storage `createSignedUploadUrl`을 받아 직업로드 (`/api/kb/upload/sign`). 키 형식 `${workspaceId}/${ulid()}/${safeName}` 강제(서버에서만 발급).
2. 업로드 완료 시 `/api/kb/upload/finalize`에서 `sources` insert + Inngest 트리거.
3. 파서 분기:
    - `.pdf` → `pdf-parse`.
    - `.pptx` → JSZip으로 슬라이드 XML 추출 + 텍스트 캡처.
    - `.docx` → `mammoth`.
    - `.xlsx` → `xlsx` (sheet별 텍스트화).
4. 이후 청킹·임베딩·요약은 URL과 동일.

**UI** — `/kb` (`app/(app)/kb/page.tsx`)

- 탭: URL / 파일. 카드 그리드: 제목·상태칩(`crawling/ready/error`)·태그.
- 카드 클릭 → 우측 Sheet: 원본 미리보기(텍스트), 학습된 청크 수, 마지막 감지 시각, "지금 재학습" 버튼.

### 5.3 5질문 대화 인터뷰 (Mode A)

**상태 머신**: `type → reader → cta → objection → sources → length → generate`

- 서버 측 `interview_sessions.answers_json`이 진실 공급원. 각 답변 후 Server Action으로 부분 저장.

**API 시퀀스**

- `POST /api/interview/start` → 문서 유형 + 시드 질의어로 KB에서 후보 소스 자동 검색 (벡터 + 태그 매칭).
- `POST /api/interview/answer` → 답 저장, 다음 질문 메시지를 Claude로 생성. 응답 형식:
    ```json
    {"step":"objection","aiMessage":"...","quickReplies":["가격 부담","구축 기간","호환성"],"insight":{...}}
    ```
- `POST /api/interview/finalize` → `document_versions` v1 생성 트리거.

**클라이언트**

- `app/(app)/chat/[documentId]/page.tsx` — 메시지 리스트 + Quick Reply 버튼 + 진행도 트랙(5단계).
- 상태: `zustand` 스토어(`interviewStore`). 서버 응답이 클라 스토어를 업데이트.
- "소스 자동 감지" 인사이트 박스 = KB에서 매칭된 chunk top-3 요약을 미리 보여줌.

**프롬프트 설계** (`src/lib/prompts/interview.ts`)

- 시스템 프롬프트: 5질문 시퀀스, 한국어, Penta Security 컨텍스트, 마지막은 항상 `quickReplies` 4개.
- KB 매칭 chunk를 `<context>` 블록으로 주입 + Anthropic prompt caching(`cache_control: ephemeral`).

### 5.4 PPT 자동 생성

**슬라이드 IR (Intermediate Representation)** — `src/lib/ppt/types.ts`

```ts
type Slide =
    | { kind: 'cover'; title; subtitle; author; date }
    | { kind: 'agenda'; items: string[] }
    | { kind: 'section'; index; title }
    | { kind: 'bullets'; title; bullets: { text; level }[] }
    | { kind: 'twoCol'; title; left: Block; right: Block }
    | { kind: 'metric'; title; metrics: { label; value; delta? }[] }
    | { kind: 'quote'; text; attribution }
    | { kind: 'image'; title?; imageRef; caption? }
    | { kind: 'cta'; headline; action };
type Deck = {
    meta: { title; reader; cta; objection; lengthPages };
    slides: Slide[];
    sourceRefs: SourceRef[];
};
```

**생성 파이프라인** (`POST /api/generate`)

1. **구조 설계** — Claude tool use로 `proposeOutline(interview, sources)` → `Slide.kind` 시퀀스 (장수 = 인터뷰 q5).
2. **컨텐츠 채움** — 슬라이드별 병렬 호출. 각 호출은 (역할 톤 + 매칭된 source chunks)을 컨텍스트로 받음. 출처 chunk ID 함께 반환.
3. **검증** — JSON 스키마(Zod) 통과 + 슬라이드별 글자 수 한도 검사. 실패 시 재시도(최대 2회).
4. **저장** — `document_versions` insert. `sourceRefs`를 `document_sources`로 정규화.
5. **미리보기** — 클라이언트가 `<Deck>` React 렌더 (Tailwind + 디자인 토큰).
6. **다운로드** (`GET /api/generate/[versionId]/pptx`) — pptxgenjs로 동일 IR를 .pptx로 변환, Supabase Storage(`docmind-pptx-cache`)에 캐시 후 signed URL로 stream.

**디자인 토큰** — Figma 템플릿 수령 완료 (2026-05-27):

- PPT 토큰: [src/design/tokens.ppt.json](../src/design/tokens.ppt.json) (Penta 코퍼레이트)
- 웹 토큰: `src/design/tokens.web.json` (Notion 스타일, **Phase 8에서 일괄 작성** — [DESIGN.md](DESIGN.md) 기반)
- 본문 9종 마스터 좌표·자산 매핑: [docs/PPT_LAYOUT_SPEC.md](PPT_LAYOUT_SPEC.md) + [src/lib/ppt/layouts.ts](../src/lib/ppt/layouts.ts) (단일 출처)
- `<Slide>` 컴포넌트와 pptxgenjs 마스터 슬라이드가 **같은 layouts.ts** 를 import → 토큰·좌표 변경 시 양쪽 자동 반영.

### 5.5 에이전트 자율 루프 (Mode B 핵심)

**Inngest 함수 5개** (`src/inngest/functions.ts`):

| 함수             | 트리거                | 역할                                                                                                                  |
| ---------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `agent.detect`   | cron `*/30 * * * *`   | 모든 `sources.kind='url'` 재크롤 → content_hash 비교. 5% 이상 변경 시 `source.changed` 이벤트.                        |
| `agent.perceive` | `source.changed`      | Claude로 변경 섹션 추출, 추가/삭제/수정 분류, JSON 저장.                                                              |
| `agent.reason`   | `source.perceived`    | 해당 source를 `document_sources`로 참조하는 모든 문서 조회 → 영향도/우선순위 산정(Opus 4.7).                          |
| `agent.act`      | `source.impact-ready` | 영향 받는 각 문서마다 `document_versions` 신버전(드래프트) 생성 + Slack 알림 + `approvals` 큐 등록.                   |
| `agent.learn`    | `source.acted`        | (소스·문서·변경유형·승인결과) 튜플을 벡터화해 `learning_patterns` 테이블에 저장. 다음 `reason`에서 KNN 가중치로 사용. |

각 함수는 Inngest step별로 `agent_events`를 append → SSE로 대시보드에 흘려보낸다.

**자동/승인 게이트** — `agents.auto_run` + `agents.config_json.policy`

- `act` 단계에서 정책 확인. `policy.publish === 'manual'`이면 발행 보류, 승인 큐만 만든다.
- Slack/이메일 발송은 **항상 승인 후 실행**(기획서 명시).

### 5.6 에이전트 대시보드

`/agent` (`app/(app)/agent/page.tsx`)

- 좌측: 에이전트 목록 (`agents` 테이블, 상태 칩 = 마지막 `agent_runs.status`).
- 중앙: 탭 — `활동 피드` / `루프 구조` / `생성된 문서`
    - 활동 피드: `/api/events/stream?workspace=...` SSE 구독. 새 `agent_events` 도착 시 상단 push. phase별 컬러.
    - 루프 구조: 5단계 노드(SVG) + 현재 활성 단계 펄스 애니메이션.
    - 생성된 문서: 최근 `document_versions` 카드(승인 대기/발행됨 칩).
- 우측: 통계 카드 + 승인 큐
    - 통계: `오늘 자동 실행 횟수`, `갱신 문서`, `시간 절감률(고정 87% 데모)`, `모니터링 개수`.
    - 승인: `approvals.where(decision is null)`. `발행 승인` / `나중에` 버튼 → Server Action `decideApproval()`.

### 5.7 알림

- Slack: 워크스페이스당 1개 webhook 또는 Bot Token(`@slack/web-api`). 메시지 빌더에 Block Kit 사용, "발행 승인" 버튼은 딥링크(`/agent?approval=...`)로 처리 (인터랙티브 핸들러는 후속).
- 이메일: Resend 템플릿 1종(승인 요청).

### 5.8 스케줄 생성 (Mode C)

- `/schedules` 페이지에서 cron 표현식 + 문서 템플릿(유형·독자·CTA·길이 프리셋) 등록.
- Inngest `agent.generate.scheduled` 크론 함수가 등록된 schedule 순회 → KB 자동 매칭 → 인터뷰 답을 템플릿에서 가져와 5.4 파이프라인 호출 → 결과는 Slack 공유 + `documents` 저장.

### 5.9 문서함

`/docs`, `/docs/[id]`

- 문서 카드 그리드, 필터(유형, 상태).
- 상세: 버전 타임라인, 버전 간 diff (slides_json 텍스트 diff), 발행/되돌리기, 다운로드(.pptx/.pdf).

---

## 6. 페이지 구조 (App Router)

```
app/
  (auth)/
    login/page.tsx
  (app)/
    layout.tsx                     # 상단 네비 + 세션 가드
    page.tsx                       # 4.1 홈: 6종 카드
    kb/page.tsx                    # 4.2 지식 베이스
    chat/[documentId]/page.tsx     # 4.3 대화 인터뷰
    agent/page.tsx                 # 4.4 에이전트 대시보드
    docs/page.tsx
    docs/[id]/page.tsx
    schedules/page.tsx
    settings/page.tsx              # 브랜드 템플릿, 알림 채널
  api/
    auth/[...nextauth]/route.ts
    kb/url/route.ts
    kb/upload/sign/route.ts
    kb/upload/finalize/route.ts
    interview/start/route.ts
    interview/answer/route.ts
    interview/finalize/route.ts
    generate/route.ts
    generate/[versionId]/pptx/route.ts
    agent/approve/route.ts
    agent/run/[id]/route.ts
    events/stream/route.ts         # SSE
    inngest/route.ts               # Inngest endpoint
    slack/events/route.ts          # (후속) interactive
```

---

## 7. 디렉토리 구조 (`src/`)

```
src/
  auth.ts                # Auth.js v5 설정
  db/
    client.ts
    schema.ts
    queries/             # 도메인별 쿼리 함수
  inngest/
    client.ts
    functions.ts         # detect/perceive/reason/act/learn
  lib/
    anthropic.ts         # SDK 클라이언트 + 캐싱 헬퍼
    embeddings.ts        # Voyage 호출
    crawler/             # html.ts, pdf.ts, docx.ts, pptx.ts, xlsx.ts
    ppt/
      types.ts           # Slide IR
      render.tsx         # React <Deck/> <Slide/>
      pptx.ts            # pptxgenjs 변환
      tokens.ts          # 디자인 토큰 import
    prompts/
      interview.ts
      outline.ts
      slide-fill.ts
      diff-perceive.ts
      impact-rank.ts
    slack.ts
    storage.ts           # Supabase Storage signed upload/download
    sse.ts               # EventSource helper + 서버 stream util
    diff.ts              # slides_json diff
    rbac.ts              # (가벼운) 워크스페이스 멤버 체크
  components/
    ui/                  # shadcn 생성물
    chat/                # MessageList, QuickReplies, ProgressTrack
    kb/                  # SourceCard, UrlInput, DropZone
    agent/               # ActivityFeed, LoopDiagram, ApprovalQueue, StatCard
    deck/                # SlidePreview (lib/ppt/render 래핑)
    nav/                 # TopNav, RunningBadge
  design/
    tokens.json          # Figma → 토큰
    tailwind-preset.ts
  styles/globals.css
```

---

## 8. 데모 시나리오 (라이브 발표용 — 반드시 끝까지 흐르게)

> 기획서 7.1과 동일한 5단계로 무대를 짠다. 시드 데이터는 마이그레이션 + `scripts/seed.ts`로 미리 심어둔다.

1. **사전 시드**: WAPPLES 제품 페이지 URL, 금융권 레퍼런스 PDF 3건, 경쟁사 비교 PPTX 1건. 모두 `status: 'ready'`로 크롤·임베딩 완료 상태.
2. **Demo A — 5질문→PPT**: 홈에서 "영업 제안서" 카드 → 인터뷰 5문답(독자=임원, CTA=계약, 반론=가격, 소스=WAPPLES, 분량=10) → 30초 내 슬라이드 미리보기 → .pptx 다운로드.
3. **Demo B — 자율 루프**: 별도 스크립트로 시드 URL의 `content_hash`를 강제 변경 → Inngest `agent.detect` 즉시 트리거(개발자 모드 "지금 감지" 버튼) → 대시보드 활동 피드에 5단계가 순차 로그 → 우측 승인 카드 등장 → "발행 승인" 클릭 → Slack 알림 발송 → 신버전 발행.

라이브 데모 실패 대비 녹화본은 `/demo/playback` 라우트에서 재생.

---

## 9. 마일스톤 (해커톤 ~ 데모일)

| 일자        | 산출물                                                                                                                                                    | Owner Hint          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| D-21 ~ D-14 | Repo 초기화, Auth.js + Google 도메인 화이트리스트, Drizzle 스키마 1차, 시드 워크스페이스                                                                  | 1명                 |
| D-14 ~ D-10 | KB URL 등록 + 크롤링 + pgvector 임베딩 end-to-end. `/kb` UI(기본 스타일) 완성                                                                             | 1명                 |
| D-10 ~ D-7  | 5질문 인터뷰 상태머신 + Claude prompts + Quick Reply UI(기본)                                                                                             | 1명                 |
| D-10 ~ D-5  | Slide IR + `<Deck>` 렌더 + pptxgenjs 다운로드 (PPT 토큰은 Phase 0 완료분 import)                                                                          | 개발 1              |
| D-7 ~ D-4   | Inngest 5함수 + 활동 피드 SSE + 승인 큐 + Slack 발송                                                                                                      | 1명                 |
| D-4 ~ D-2   | **Phase 8: UI 디자인 시스템 적용** ([DESIGN.md](DESIGN.md)) — `tokens.web.json` + Tailwind preset + shadcn 컴포넌트 토큰 매핑 + 화면별 폴리시 + 다크 모드 | 디자이너 1 + 개발 1 |
| D-2 ~ D-1   | Phase 9: 시드 데이터, `/demo/playback` 녹화본, 시나리오 리허설, Sentry 연결                                                                               | 전원                |

> 1차 컷오프(D-4)에 **데모 시나리오 두 개가 끝까지 안 돌면** Mode C(스케줄)와 문서함 diff 뷰는 컷.
> 2차 컷오프(D-2)에 **디자인 적용이 60% 미만** 이면 다크 모드와 모바일 폴리시는 Phase 9 직전 컷 후보.

---

## 10. 핵심 비기능 요구사항

- **응답 시간**: 5질문 단일 답변 응답 < 2.5s (스트리밍). PPT 생성 < 25s.
- **속도**: Anthropic prompt caching으로 시스템 프롬프트/소스 chunk 재사용. 같은 인터뷰 세션 내 캐시 적중 ≥ 70%.
- **보안**: Google `hd` 검증, `pentasecurity.com` 외 회원가입 차단. Supabase Storage signed URL TTL 5분, 버킷은 Private + 모든 RLS policy deny(서버 service role만 접근). Slack 토큰은 Vercel env. PII는 로그에 남기지 않음(Sentry beforeSend 마스킹).
- **관찰성**: 모든 `agent_events`는 영구 보관. SSE는 누락 대비 클라이언트가 `?since=eventId` 재구독.
- **격리**: 모든 쿼리에 `workspace_id` 필터 필수. Drizzle 헬퍼 `scoped(ws).from(...)`로 강제.

---

## 11. 검증 (Verification)

데모 직전 다음을 순서대로 통과시켜야 "완성"으로 간주한다.

1. **회원가입**: `@pentasecurity.com` 계정 로그인 성공, 비-펜타 계정 거부 응답 확인.
2. **KB URL**: `https://pentasecurity.com/products/wapples` 등록 → 60초 내 `status='ready'`, chunk 수 ≥ 20, 태그 자동 생성.
3. **KB 파일**: 샘플 PDF/PPTX/DOCX/XLSX 각 1건 업로드 → 모두 ready, 본문 검색 시 텍스트 hit.
4. **인터뷰→PPT**: 영업 제안서 시나리오로 5질문 완주 → 미리보기 슬라이드 ≥ 8장 → .pptx 다운로드 후 PowerPoint에서 열림 확인 → 표지에 디자인 토큰 적용 확인.
5. **자율 루프**: `content_hash` 강제 변경 → 30초 내 활동 피드에 5단계 모두 로그 → 승인 카드 등장 → 승인 후 Slack 채널 #docmind-demo 메시지 도착 → `document_versions` 신버전 published.
6. **스케줄 (옵션)**: 임시 스케줄을 `* * * * *`로 등록 → 1분 내 새 문서 자동 생성, Slack에 공유 링크 도착.
7. **회복**: Inngest 실패 시뮬레이션(`throw` 주입) → step 재시도 + 사용자에게 빨간 칩 표시 + 에러 로그 Sentry 도착.

---

## 12. 환경 변수

```
# Auth
AUTH_SECRET=                              # openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAIL_DOMAIN=pentasecurity.com
NEXT_PUBLIC_APP_URL=                      # https://docmind.pentasecurity.com

# Supabase (DB + Storage)
SUPABASE_URL=                             # https://<ref>.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=                # 서버 전용. 절대 클라 노출 X
SUPABASE_DB_URL=                          # Supavisor pooler URL (앱 런타임)
SUPABASE_DB_URL_DIRECT=                   # Direct connection (마이그레이션 전용)
SUPABASE_BUCKET_SOURCES=docmind-sources
SUPABASE_BUCKET_PPTX=docmind-pptx-cache

# AI
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=

# 백그라운드 잡
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# 알림
SLACK_BOT_TOKEN=
SLACK_DEFAULT_CHANNEL_ID=                 # C0xxxxxx
RESEND_API_KEY=

# 옵저버빌리티
SENTRY_DSN=
```

---

## 13. 향후 확장 여지 (1차 컷에서 제외, 인터페이스만 남김)

- 멀티 워크스페이스 + SSO/SAML (Enterprise 플랜).
- 팀 공유 지식 베이스 권한 모델(`workspace_members.role` 활용).
- Slack 인터랙티브 승인(Block 버튼에서 바로 발행).
- Box / Notion / Jira MCP 어댑터(현재는 URL 크롤링과 Supabase Storage 업로드로만 흡수). 인터페이스는 `lib/sources/adapter.ts`로 추상화해두고, 후속에 MCP 클라이언트만 갈아끼움.
- 직군별 톤 자동 조정(영업/기술/경영진) 프롬프트 모듈화 — outline.ts에 슬롯만 비워둔다.

---

## 14. 위험 요소 & 완화

| 리스크                                                     | 영향                    | 완화                                                                                                                                                                                                                         |
| ---------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 라이브 LLM 호출 지연/실패                                  | 데모 망함               | (a) prompt caching, (b) 시드 인터뷰의 **사전 생성본** fallback, (c) `/demo/playback` 녹화.                                                                                                                                   |
| Slack 발송 차단                                            | "행동" 단계 시연 불가   | Slack 미설정 시 자체 Toast로 대체, 둘 다 활동 피드에 기록.                                                                                                                                                                   |
| pptxgenjs와 웹 렌더 디자인 불일치                          | 다운로드 결과 부끄러움  | 둘이 **같은 토큰**을 import + 슬라이드 종류별 골든 스냅샷 테스트(Playwright + .pptx 텍스트 추출 비교).                                                                                                                       |
| pgvector 쿼리 성능                                         | 임베딩 늘면 지연        | ivfflat 인덱스 + `lists=100`, 데모 데이터 ≤ 5천 chunk로 한정.                                                                                                                                                                |
| Figma 템플릿 도착 지연                                     | 디자인 완성 지연        | ~~토큰 기본값(`design/tokens.default.json`)~~ **해소됨**: PPT 템플릿 2026-05-27 수령 완료. [tokens.ppt.json](../src/design/tokens.ppt.json) + [PPT_LAYOUT_SPEC.md](PPT_LAYOUT_SPEC.md) 확정.                                 |
| 디자인 적용을 Phase 8 로 미뤄둔 결과 막판 폴리시 시간 부족 | 데모 시각적 완성도 부족 | (a) Phase 1–7 내내 shadcn 기본값을 **일관적으로** 사용해 Phase 8 교체 비용 최소화 (hex 직접 박기 금지), (b) Phase 8 산출물을 컴포넌트 → 화면 순서로 작게 쪼개 점진 머지, (c) 다크 모드·모바일 폴리시는 Phase 9 직전 컷 후보. |

---

## 15. Phase별 구현 계획

각 Phase는 직전 Phase의 핵심 산출물이 동작해야 진행 가능하다. 체크박스는 구현 완료 시 표시해 진행 상태를 추적한다. Phase 0(사전 준비)은 코딩 전에 끝낸다 — 외부 인프라/계정 문제는 막판에 풀기 가장 어렵다.

> **UI 디자인 정책**: Phase 1–7 의 UI 는 **shadcn/ui 기본 스타일 + Tailwind 기본 토큰**으로 *기능 우선·디자인 후순위*로 구현한다. [docs/DESIGN.md](DESIGN.md) / [docs/DESIGN_GUIDE.md](DESIGN_GUIDE.md) 기반의 디테일한 디자인 시스템 적용(`tokens.web.json`, Pretendard, Notion 스타일 컴포넌트 토큰, 다크 모드)은 **Phase 8 에서 일괄** 수행한다. 이유: 전체 화면을 동시에 보며 일관성을 잡기 위함. PPT 디자인 토큰([tokens.ppt.json](../src/design/tokens.ppt.json))은 별개 — Phase 0 에서 이미 확정.

진행 상태 한눈에: ⬜ 미시작 · 🟡 진행중 · ✅ 완료

### Phase 0 — 사전 준비 사항 🟡

> **산출물**: 8개 외부 의존성 모두 키/URL 확보. `.env.local`이 완전히 채워진다.

**Supabase**

- [x] [supabase.com](https://supabase.com) 프로젝트 생성 (region: `ap-northeast-1`)
- [x] SQL Editor에서 `select * from pg_available_extensions where name='vector'` 확인 (Supabase는 기본 활성)
- [x] `create extension if not exists pg_trgm;` 실행 (태그 검색 보조)
- [x] Settings → Database에서 **Connection pooler URL**(`SUPABASE_DB_URL`)과 **Direct connection URL**(`SUPABASE_DB_URL_DIRECT`) 확보
- [x] Settings → API에서 `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` 확보
- [x] Storage → Buckets에서 `docmind-sources`, `docmind-pptx-cache` 두 개 생성 (Private)
- [x] 두 버킷 모두 RLS Policy 비활성(기본). 접근은 service role로만.

**Vercel**

- [ ] GitHub 레포 생성 후 Vercel에 import
- [ ] Production/Preview/Development 환경에 위 환경변수 전체 등록
- [ ] `vercel.json` 또는 라우트 단위로 `maxDuration: 300` 설정 (`/api/generate/*`, `/api/events/stream`)
- [ ] 커스텀 도메인 연결 (`docmind.pentasecurity.com`) 또는 Vercel URL 확정

**Google OAuth**

- [x] Google Cloud Console에서 프로젝트 생성
- [x] OAuth consent screen User Type: **Internal** (Workspace `pentasecurity.com` 결제 도메인 전제)
- [x] OAuth 2.0 Client ID 발급, redirect URI 등록 (prod + `http://localhost:3000/api/auth/callback/google`)
- [x] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 확보
- [x] `AUTH_SECRET` 생성 (`openssl rand -base64 32`)

**Inngest**

- [x] [inngest.com](https://inngest.com) 가입 + 앱 `docmind` 생성
- [x] `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` 확보
- [x] 로컬: `npx inngest-cli@latest dev` 동작 확인

**LLM / 임베딩**

- [x] [console.anthropic.com](https://console.anthropic.com) — API Key 발급 + 결제수단 등록 + 월 한도 상향
- [x] [voyageai.com](https://voyageai.com) — API Key 발급, `voyage-3` 호출 1회 검증(미완료)

**Slack**

- [x] Slack App 생성, Bot Token Scopes: `chat:write`, `chat:write.public`, `files:write`(옵션)
- [x] 워크스페이스 설치 → `SLACK_BOT_TOKEN` (xoxb-...) 확보
- [x] 채널 `#docmind-demo` 생성, `/invite @DocMind Agent`
- [x] 채널 ID(`C0xxxxxx`)를 `SLACK_DEFAULT_CHANNEL_ID`로 등록
- [x] (백업) Incoming Webhook 1개 별도 발급

**이메일 / 옵저버빌리티 / 디자인**

- [ ] Resend 계정 + `RESEND_API_KEY` 발급, 발신 도메인 검증
- [ ] Sentry 프로젝트 생성 + `SENTRY_DSN` 확보
- [x] ~~`src/design/tokens.default.json` 초안 작성~~ → [src/design/tokens.ppt.json](../src/design/tokens.ppt.json) (PPT 토큰) + Phase 8에서 [src/design/tokens.web.json](../src/design/tokens.web.json) 별도 작성 예정 ([DESIGN.md](DESIGN.md) 기반 Notion 스타일)
- [x] Figma 템플릿 수령 완료 → [docs/PPT_LAYOUT_SPEC.md](PPT_LAYOUT_SPEC.md) 에 표지·엔딩 토큰 + 본문 9종 마스터 정의, [src/lib/ppt/layouts.ts](../src/lib/ppt/layouts.ts) 에 좌표 코드화

**로컬 개발 환경**

- [ ] Node.js 22 + pnpm 9 설치 (`corepack enable && corepack prepare pnpm@latest --activate`)
- [ ] `.env.local`에 위 모든 키 채움
- [ ] `inngest-cli dev` + Vercel CLI(`vercel dev`) 양립 확인

---

### Phase 1 — 레포 부트스트랩 & 인증 기반 ✅

> **산출물**: `@pentasecurity.com` 로그인 후 빈 홈 화면(6종 카드)이 뜬다. DB 마이그레이션이 통과한다.

**프로젝트 초기화**

- [x] `pnpm create next-app@latest .` (Next 16.2.6, TypeScript, App Router, Tailwind, ESLint, src/, alias `@/*`) — 2026-05-28 in-place 부트스트랩 완료. plan 의 `docmind` 폴더명은 `DocMind` 대문자 충돌로 `.` 사용. Next 버전은 16 으로 상향 (결정 로그 참조)
- [x] shadcn/ui 초기화: `pnpm dlx shadcn@latest init --yes --defaults` (Slate base, CSS variables) — 2026-05-28
- [x] 기본 컴포넌트 추가: `button card dialog sheet tabs badge input textarea sonner separator skeleton dropdown-menu` — 2026-05-28 (toast → sonner 대체, 결정 로그 참조)
- [x] `tsconfig.json` 확인 — `strict: true`, `paths: { "@/*": ["./src/*"] }` 모두 정상

**DB & 스키마**

- [x] `pnpm add drizzle-orm postgres @supabase/supabase-js`, `pnpm add -D drizzle-kit dotenv tsx` — 2026-05-28
- [x] [src/db/client.ts](../src/db/client.ts) — `postgres-js` + `prepare: false` + HMR-safe global cache
- [x] [src/db/schema.ts](../src/db/schema.ts) — 20개 테이블 (4장 17개 + Auth.js 표준 accounts/sessions/verification_tokens 3개)
- [x] [drizzle.config.ts](../drizzle.config.ts) 작성
- [x] [drizzle/0000_worried_squadron_sinister.sql](../drizzle/0000_worried_squadron_sinister.sql) 생성 + 적용 — 20 tables, 2 indexes. `CREATE EXTENSION vector` 를 수동 prepend (Phase 0 의 `select pg_available_extensions` 는 활성화가 아니라 'available' 확인이었음, 함정 항목 참조)
- [x] [drizzle/0001_pgvector_index.sql](../drizzle/0001_pgvector_index.sql) — `ivfflat (embedding vector_cosine_ops) WITH (lists=100)` 적용
- [x] **`drizzle-kit migrate` 대신 [scripts/migrate.ts](../scripts/migrate.ts) (`pnpm db:migrate`)** — Supabase Free tier 의 Direct URL 이 IPv6-only 라 IPv4-only 환경에서 ENOTFOUND. Pooler URL + `prepare: false` + `max: 1` 로 우회 (함정 항목 참조)
- [x] [scripts/seed-workspace.ts](../scripts/seed-workspace.ts) (`pnpm db:seed`) — "Penta Security" 워크스페이스 1건 생성 완료 (id=014ac9f8-cda3-4ea0-87e4-30e5eb750ad8)

**인증**

- [x] `pnpm add next-auth@beta @auth/drizzle-adapter` — 2026-05-28 (next-auth 5.0.0-beta.31, @auth/drizzle-adapter 1.11.2)
- [x] [src/auth.config.ts](../src/auth.config.ts) + [src/auth.ts](../src/auth.ts) — Edge-compatible split config (결정 로그 참조). Google Provider `hd=pentasecurity.com` + `prompt=select_account`
- [x] `signIn` 콜백에서 `profile.email_verified === true && profile.hd === ALLOWED_EMAIL_DOMAIN` 이중 검증 ([src/auth.config.ts](../src/auth.config.ts))
- [x] [src/middleware.ts](../src/middleware.ts) — `authorized` 콜백으로 보호 라우트 가드. 로그인 시 `/login` 접근하면 `/` 로 리다이렉트. **Next 16 deprecation 경고: `middleware` → `proxy` 마이그레이션 예정 (함정 항목 참조)**
- [x] [src/app/api/auth/[...nextauth]/route.ts](../src/app/api/auth/[...nextauth]/route.ts)
- [x] [src/app/(auth)/login/page.tsx](<../src/app/(auth)/login/page.tsx>) — Google 로그인 버튼 (Server Action `signIn("google")`)
- [x] 첫 로그인 시 시드 워크스페이스 자동 가입 ([src/auth.ts](../src/auth.ts) `events.signIn` — "Penta Security" 워크스페이스에 owner 멤버 upsert)

**홈 셸**

- [x] [src/app/(app)/layout.tsx](<../src/app/(app)/layout.tsx>) — 세션 가드 + TopNav 마운트 (인증 단계의 가드 위에 nav 추가)
- [x] [src/components/nav/TopNav.tsx](../src/components/nav/TopNav.tsx) + [src/components/nav/NavLink.tsx](../src/components/nav/NavLink.tsx) — 로고/메뉴(홈·KB·에이전트·문서함)/사용자 이메일·로그아웃. 실행중 배지(`RunningBadge`)는 Phase 5 에서 `agent_runs.status='running'` 카운트로 연결 — 현재 코드에 slot 만 주석으로 표시
- [x] [src/app/(app)/page.tsx](<../src/app/(app)/page.tsx>) — 6종 카드 그리드 (영업/기획/사업/기술/회의/마케팅, lucide 아이콘). 클릭 시 `/chat/new?type=<id>` 로 — Phase 3 에서 실 라우트 추가될 때까지는 404

**관찰성**

- [x] Sentry Next.js wizard 적용 (`@sentry/nextjs@^10.54`) — 2026-05-28 `npx @sentry/wizard@latest -i nextjs --saas --org pentasecurity-mh --project javascript-nextjs`
- [x] [src/instrumentation.ts](../src/instrumentation.ts) + [src/instrumentation-client.ts](../src/instrumentation-client.ts) + [sentry.server.config.ts](../sentry.server.config.ts) + [sentry.edge.config.ts](../sentry.edge.config.ts) + [src/app/global-error.tsx](<../src/app/global-error.tsx>) 생성, [next.config.ts](../next.config.ts) 를 `withSentryConfig` 로 wrap, [.env.sentry-build-plugin](../.env.sentry-build-plugin) (gitignored) 에 build 시 소스맵 업로드용 토큰. **wizard 기본값 `sendDefaultPii: true` 는 plan §10 위반이라 3 파일 모두 `false` 로 강제 변경 (결정 로그 참조)**. DSN 은 wizard 가 코드에 직접 하드코딩 — `SENTRY_DSN` env 는 unused (.env 주석 갱신)

**검증**

- [x] `@pentasecurity.com` 계정 로그인 성공 — 2026-05-28 사용자 브라우저 확인
- [x] 외부 도메인 계정 거부 응답 — 2026-05-28 [scripts/verify-signin.ts](../scripts/verify-signin.ts) 로 5개 케이스 (penta+verified=OK, gmail/다른hd/unverified/null=거부) 모두 통과. 실 OAuth 흐름 검증은 사용자가 외부 Google 계정으로 추가 확인 시 더 견고
- [x] 홈 카드 6개 노출 — 2026-05-28 [src/app/(app)/page.tsx](<../src/app/(app)/page.tsx>) DOC_TYPES 배열 6 entries 확인 (sales/plan/business/tech/meeting/marketing), 타입체크·ESLint 클린. 시각적 확인은 사용자 브라우저 작업
- [x] DB에 user/workspace_member row 생성 확인 — 2026-05-28 사용자 확인

---

### Phase 2 — 지식 베이스 (KB) ⬜

> **산출물**: WAPPLES URL 등록 → 60초 내 `ready` → /kb 카드 노출. PDF/PPTX/DOCX/XLSX 파일도 동일 흐름.

**공통 인프라**

- [ ] `pnpm add @anthropic-ai/sdk voyageai inngest p-limit ulid zod`
- [ ] [src/lib/anthropic.ts](src/lib/anthropic.ts) — SDK 클라이언트 + prompt caching 헬퍼
- [ ] [src/lib/embeddings.ts](src/lib/embeddings.ts) — Voyage 호출 (배치 128, `p-limit(5)`)
- [ ] [src/lib/storage.ts](src/lib/storage.ts) — Supabase Storage signed upload/download
- [ ] [src/inngest/client.ts](src/inngest/client.ts) + [app/api/inngest/route.ts](app/api/inngest/route.ts)

**크롤러 / 파서**

- [ ] `pnpm add undici cheerio pdf-parse mammoth xlsx jszip @mozilla/readability jsdom`
- [ ] [src/lib/crawler/html.ts](src/lib/crawler/html.ts) — undici + cheerio + Readability
- [ ] [src/lib/crawler/pdf.ts](src/lib/crawler/pdf.ts)
- [ ] [src/lib/crawler/docx.ts](src/lib/crawler/docx.ts)
- [ ] [src/lib/crawler/xlsx.ts](src/lib/crawler/xlsx.ts)
- [ ] [src/lib/crawler/pptx.ts](src/lib/crawler/pptx.ts) — JSZip + slideN.xml
- [ ] [src/lib/chunk.ts](src/lib/chunk.ts) — 500~800 토큰 분할 (문단/문장 boundary 우선)
- [ ] (옵션) Playwright fallback 모듈 (JS 렌더 페이지 대비)

**KB 워커**

- [ ] [src/inngest/functions.ts](src/inngest/functions.ts)에 `source.crawl.requested` 핸들러 추가
    - [ ] Step 1: fetch + 파서 분기
    - [ ] Step 2: chunk + 임베딩
    - [ ] Step 3: Claude로 title/summary/tags[] 생성
    - [ ] Step 4: `sources.status='ready'` + content_hash 저장

**API**

- [ ] [app/api/kb/url/route.ts](app/api/kb/url/route.ts) — URL 등록 + Inngest 트리거
- [ ] [app/api/kb/upload/sign/route.ts](app/api/kb/upload/sign/route.ts) — Supabase signed upload URL 발급
- [ ] [app/api/kb/upload/finalize/route.ts](app/api/kb/upload/finalize/route.ts) — sources insert + Inngest 트리거

**UI**

- [ ] [app/(app)/kb/page.tsx](<app/(app)/kb/page.tsx>) — URL/파일 탭, 카드 그리드
- [ ] [src/components/kb/SourceCard.tsx](src/components/kb/SourceCard.tsx) — 상태 칩/태그
- [ ] [src/components/kb/UrlInput.tsx](src/components/kb/UrlInput.tsx)
- [ ] [src/components/kb/DropZone.tsx](src/components/kb/DropZone.tsx) — react-dropzone
- [ ] [src/components/kb/SourceSheet.tsx](src/components/kb/SourceSheet.tsx) — 우측 Sheet (원본 미리보기, 청크 수, 재학습)

**검증**

- [ ] WAPPLES URL → chunk ≥ 20, 태그 ≥ 2개 자동 생성
- [ ] PDF/DOCX/XLSX/PPTX 샘플 각 1건 ready 확인
- [ ] 벡터 검색 호출(`select ... order by embedding <=> $1 limit 5`) 1회 hit

---

### Phase 3 — 5질문 대화 인터뷰 ⬜

> **산출물**: 홈 카드 클릭 → 5문답 완주 → finalize 호출.

**프롬프트**

- [ ] [src/lib/prompts/interview.ts](src/lib/prompts/interview.ts) — 시스템 프롬프트 + 단계별 instruction
- [ ] KB top-3 chunk를 `<context>` 블록으로 주입 + `cache_control: ephemeral`
- [ ] 응답 JSON 스키마(Zod): `step / aiMessage / quickReplies[4] / insight`

**상태머신**

- [ ] [src/lib/interview/machine.ts](src/lib/interview/machine.ts) — `type→reader→cta→objection→sources→length→generate`
- [ ] zustand 스토어 `interviewStore`

**API**

- [ ] [app/api/interview/start/route.ts](app/api/interview/start/route.ts) — 문서 유형으로 KB 후보 검색
- [ ] [app/api/interview/answer/route.ts](app/api/interview/answer/route.ts) — 부분 저장 + 다음 질문 생성
- [ ] [app/api/interview/finalize/route.ts](app/api/interview/finalize/route.ts) — Phase 4 generate 트리거

**UI**

- [ ] [app/(app)/chat/[documentId]/page.tsx](<app/(app)/chat/[documentId]/page.tsx>)
- [ ] [src/components/chat/MessageList.tsx](src/components/chat/MessageList.tsx)
- [ ] [src/components/chat/QuickReplies.tsx](src/components/chat/QuickReplies.tsx)
- [ ] [src/components/chat/ProgressTrack.tsx](src/components/chat/ProgressTrack.tsx) — 5단계 진행도
- [ ] [src/components/chat/InsightBox.tsx](src/components/chat/InsightBox.tsx) — KB 매칭 인사이트

**검증**

- [ ] 5문답 완주 시간 < 2분
- [ ] 응답 지연 < 2.5s (스트리밍 시작 기준)
- [ ] `interview_sessions.answers_json` 부분 저장 확인 (중간 새로고침 시 복원)

---

### Phase 4 — PPT 자동 생성 ⬜

> **산출물**: finalize 후 미리보기 슬라이드 ≥ 8장 표시 + .pptx 다운로드 정상.

**Slide IR**

- [ ] [src/lib/ppt/types.ts](src/lib/ppt/types.ts) — Slide 9종 + Zod 스키마 (Deck.meta에 `securityLevel/author/date` 추가 — [PPT_LAYOUT_SPEC §6](PPT_LAYOUT_SPEC.md#6-slide-ir-매핑-srclibppttypests))
- [x] [src/design/tokens.ppt.json](../src/design/tokens.ppt.json) — PPT 디자인 토큰 (Phase 0 완료)
- [x] [src/lib/ppt/layouts.ts](../src/lib/ppt/layouts.ts) — 9종 마스터 좌표/스타일 코드화 (Phase 0 완료)

> 웹 UI 토큰(`tokens.web.json`)과 Tailwind preset 은 **Phase 8** 에서 일괄 작성. Phase 4 는 PPT 출력만 책임지며, 미리보기 `<Slide>` 컴포넌트는 PPT 토큰을 직접 import 한다 (웹 토큰과 무관).

**LLM 파이프라인**

- [ ] [src/lib/prompts/outline.ts](src/lib/prompts/outline.ts) — tool use로 Slide.kind 시퀀스 제안
- [ ] [src/lib/prompts/slide-fill.ts](src/lib/prompts/slide-fill.ts) — 슬라이드별 컨텐츠 채움 (출처 chunk ID 반환)
- [ ] 슬라이드별 병렬 호출 + 글자 수 한도 검증 + 2회 재시도

**렌더**

- [ ] [src/lib/ppt/render.tsx](src/lib/ppt/render.tsx) — `<Deck>` + `<Slide kind="...">` 9종
- [ ] [src/lib/ppt/pptx.ts](src/lib/ppt/pptx.ts) — 동일 IR을 pptxgenjs로 변환
- [ ] 마스터 슬라이드/레이아웃 9종 정의 (cover/agenda/section/bullets/twoCol/metric/quote/image/cta)
- [ ] 한글 폰트 임베딩 (`embedFonts` 옵션 검토) 또는 `맑은 고딕` fallback

**API**

- [ ] [app/api/generate/route.ts](app/api/generate/route.ts) — outline → fill → 저장
- [ ] [app/api/generate/[versionId]/pptx/route.ts](app/api/generate/[versionId]/pptx/route.ts) — pptxgenjs → Supabase Storage 캐시 → signed URL stream

**UI**

- [ ] [src/components/deck/SlidePreview.tsx](src/components/deck/SlidePreview.tsx)
- [ ] [src/components/deck/DeckViewer.tsx](src/components/deck/DeckViewer.tsx) — 좌측 썸네일 + 우측 큰 슬라이드

**검증**

- [ ] 생성 시간 < 25s
- [ ] .pptx 다운로드 후 PowerPoint/Keynote에서 열림, 깨진 폰트 없음
- [ ] 미리보기와 .pptx 결과가 시각적으로 동일

---

### Phase 5 — 에이전트 자율 루프 ⬜

> **산출물**: 시드 URL의 `content_hash` 강제 변경 시 30초 내 5단계 phase event 모두 기록 + `approvals` row 생성.

**Inngest 5함수**

- [ ] `agent.detect` (cron `*/30 * * * *`) — 재크롤 + content_hash 비교 + 5% 임계
- [ ] `agent.perceive` — diff 섹션 분류 (Claude)
- [ ] `agent.reason` — 영향 문서/우선순위 (Opus 4.7)
- [ ] `agent.act` — 신버전 드래프트 + 승인 큐 + (승인 후) Slack 발송
- [ ] `agent.learn` — pattern 벡터 upsert (`learning_patterns` 테이블 추가)

**보조**

- [ ] [src/lib/agent/events.ts](src/lib/agent/events.ts) — `appendEvent(runId, phase, type, payload)` step 헬퍼
- [ ] [src/lib/agent/policy.ts](src/lib/agent/policy.ts) — `auto_run` + `policy.publish === 'manual'` 게이트
- [ ] 개발자 모드 "지금 감지" 버튼 → `POST /api/agent/run/[id]/trigger`

**API**

- [ ] [app/api/agent/approve/route.ts](app/api/agent/approve/route.ts) — 승인/거부 처리
- [ ] [app/api/agent/run/[id]/route.ts](app/api/agent/run/[id]/route.ts) — run 상세 조회

**검증**

- [ ] `content_hash` 강제 변경 스크립트 실행 → 30초 내 detect/perceive/reason/act/learn 5개 event 기록
- [ ] approval 행이 생성, Slack 발송은 보류 상태
- [ ] 승인 클릭 후 `document_versions.status='published'`

---

### Phase 6 — 알림 (Slack / Email) ⬜

> **산출물**: 승인 클릭 → `#docmind-demo` 채널에 Block Kit 메시지 도착 + 딥링크 동작.

- [ ] `pnpm add @slack/web-api resend`
- [ ] [src/lib/slack.ts](src/lib/slack.ts) — WebClient + Block Kit 빌더 (제목/변경요약/승인링크)
- [ ] [src/lib/email.ts](src/lib/email.ts) — Resend 승인 요청 템플릿
- [ ] `notifications` 테이블에 발송 이력 기록
- [ ] Slack 발송 실패 fallback: in-app toast + activity feed에 빨간 칩
- [ ] **검증**: 메시지 도착 + "발행 승인" 버튼 클릭 시 `/agent?approval=<id>` 진입 + 해당 카드 하이라이트

---

### Phase 7 — 대시보드 & 보조 화면 ⬜

> **산출물**: 실시간 활동 피드 + 승인 큐가 보이는 에이전트 대시보드. 문서함/스케줄/설정.

**실시간**

- [ ] [app/api/events/stream/route.ts](app/api/events/stream/route.ts) — SSE (`text/event-stream`, `no-cache, no-transform`, Node runtime)
- [ ] [src/lib/sse.ts](src/lib/sse.ts) — 서버 stream util + 클라 EventSource + `?since=eventId` 재구독

**에이전트 대시보드**

- [ ] [app/(app)/agent/page.tsx](<app/(app)/agent/page.tsx>)
- [ ] [src/components/agent/AgentList.tsx](src/components/agent/AgentList.tsx) — 좌측 패널
- [ ] [src/components/agent/ActivityFeed.tsx](src/components/agent/ActivityFeed.tsx) — phase별 컬러
- [ ] [src/components/agent/LoopDiagram.tsx](src/components/agent/LoopDiagram.tsx) — 5단계 SVG + 펄스
- [ ] [src/components/agent/ApprovalQueue.tsx](src/components/agent/ApprovalQueue.tsx)
- [ ] [src/components/agent/StatCard.tsx](src/components/agent/StatCard.tsx) — 자동 실행/갱신/시간 절감/모니터링 4개

**문서함**

- [ ] [app/(app)/docs/page.tsx](<app/(app)/docs/page.tsx>) — 카드 그리드 + 필터
- [ ] [app/(app)/docs/[id]/page.tsx](<app/(app)/docs/[id]/page.tsx>) — 버전 타임라인 + diff
- [ ] [src/lib/diff.ts](src/lib/diff.ts) — slides_json 텍스트 diff

**스케줄 (Mode C)**

- [ ] [app/(app)/schedules/page.tsx](<app/(app)/schedules/page.tsx>) — cron + 템플릿 등록
- [ ] Inngest `agent.generate.scheduled` 크론 함수

**설정**

- [ ] [app/(app)/settings/page.tsx](<app/(app)/settings/page.tsx>) — 브랜드 템플릿/알림 채널/에이전트 정책

**검증**

- [ ] 새 event 생성 후 활동 피드에 1초 이내 노출
- [ ] 승인 큐에서 클릭 → 발행 + Slack 발송 + 피드에 ✅
- [ ] 문서 상세에서 v1 vs v2 diff 가독성 OK
- [ ] 1분 스케줄 등록 시 1분 내 새 문서 생성

---

### Phase 8 — UI 디자인 시스템 적용 ([DESIGN.md](DESIGN.md)) ⬜

> **전제**: Phase 1–7 의 모든 화면이 기능적으로 동작하고, shadcn 기본 스타일로 빠르게 구현되어 있다.
> **산출물**: 모든 페이지가 [docs/DESIGN.md](DESIGN.md) Notion 스타일을 따른다. 색·타이포·여백·컴포넌트가 단일 토큰셋(`tokens.web.json`)을 통해 일관 적용되고, 다크 모드가 동작한다.

**디자인 토큰 추출**

- [ ] [src/design/tokens.web.json](../src/design/tokens.web.json) — [DESIGN.md](DESIGN.md)의 색(brand/spectrum/tint/surface/text/semantic), 타이포(hero-display~caption-bold), 간격(xxs~hero), elevation, radius 토큰을 JSON 단일화
- [ ] [src/design/tailwind-preset.ts](../src/design/tailwind-preset.ts) — 토큰 → Tailwind theme.extend (colors/fontSize/spacing/borderRadius/boxShadow)
- [ ] `app/globals.css` — `:root` + `.dark` 에 CSS 변수 정의 (shadcn 호환 HSL 형식 + 토큰 동시 export)
- [ ] `next/font` 로 **Pretendard Variable** 로딩 + `font-sans` 기본 매핑

**shadcn 컴포넌트 토큰 매핑**

- [ ] `button` — DESIGN.md `button-primary` (purple `{colors.primary}`, `rounded-md`, padding `10px 18px`) / `button-dark` / `button-secondary` / `button-ghost` / `button-link`
- [ ] `card` — `rounded-lg` + 1px `{colors.hairline}` border + 기본 elevation 0
- [ ] `input` / `textarea` — `rounded-md` height 44, focus 시 `2px solid {colors.primary}`
- [ ] `badge` — purple/pink/orange/tag-pastel 5종 variant
- [ ] `dialog` / `sheet` / `dropdown-menu` — elevation 4 (`rgba(15,15,15,0.16) 0 16 48 -8`)
- [ ] `tabs` — `pill-tab` (rounded-full) + `segmented-tab` (underline) 2종
- [ ] `separator` — `{colors.hairline-soft}` 1px
- [ ] `skeleton` — `{colors.surface-soft}` 베이스, 톤다운 펄스

**화면별 적용** (Phase 1–7 산출 페이지를 순회)

- [ ] [app/(auth)/login/page.tsx](<../app/(auth)/login/page.tsx>) — 중앙 정렬, 친근한 어조 안내 문구, `button-primary` Google 버튼
- [ ] [app/(app)/page.tsx](<../app/(app)/page.tsx>) (홈) — 6종 카드 그리드를 **pastel feature tile** 톤(peach/rose/mint/lavender/sky/yellow)으로 매핑
- [ ] [app/(app)/kb/page.tsx](<../app/(app)/kb/page.tsx>) — SourceCard 호버 시 `{colors.surface}` 배경, 상태 칩 색상은 semantic 토큰, 우측 Sheet hairline 디바이더
- [ ] [app/(app)/chat/[documentId]/page.tsx](<../app/(app)/chat/[documentId]/page.tsx>) — 메시지 행 간격 충분히, Quick Reply 는 `pill-tab` 톤, InsightBox 는 `card-feature-yellow-bold` 변형
- [ ] [app/(app)/agent/page.tsx](<../app/(app)/agent/page.tsx>) — ActivityFeed phase별 컬러(brand spectrum), LoopDiagram 5단계, StatCard 4종, ApprovalQueue
- [ ] [app/(app)/docs/page.tsx](<../app/(app)/docs/page.tsx>) + [docs/[id]](<../app/(app)/docs/[id]/page.tsx>) — 카드 그리드 + 버전 타임라인 + diff 가독성
- [ ] [app/(app)/schedules/page.tsx](<../app/(app)/schedules/page.tsx>), [settings/page.tsx](<../app/(app)/settings/page.tsx>) — cron 입력, 토글, 채널 선택 UI

**다크 모드**

- [ ] DESIGN.md `.dark` 토큰 — **따뜻한 다크 톤** (순흑 `#000` 사용 금지)
- [ ] `next-themes` 설치 + 상단 네비에 토글
- [ ] 모든 페이지 다크 토글 시 가독성/대비 검수

**디자인 QA**

- [ ] 페이지별 스크린샷(라이트/다크) → [DESIGN_GUIDE.md](DESIGN_GUIDE.md) "디자인 핵심 원칙" 6가지 대조 (여백 우선 / 따뜻한 미니멀리즘 / 산세리프 헤딩 / 부드러운 표면 / 절제된 색상 / 장식 최소화)
- [ ] 모바일 (< 768px) 레이아웃 검수 — Phase 1–7 까지 데스크탑 우선이었으므로
- [ ] 접근성: focus ring, 색 대비 (WCAG AA)

**검증**

- [ ] `grep -rE '#[0-9A-Fa-f]{6}' src/components/ src/app/` 결과 0 (hex 직접 박힌 곳 없음)
- [ ] shadcn 기본 색 그대로 남아있는 곳 0 (모두 토큰 경유)
- [ ] PPT 토큰(`tokens.ppt.json`)과 웹 토큰(`tokens.web.json`) **분리 유지** — 서로 import 금지
- [ ] 임의 페이지 5장 캡처 시 DESIGN.md 와 시각적 일관성 통과

---

### Phase 9 — 데모 준비 & 최종 검증 ⬜

> **산출물**: 라이브 데모 2개 시나리오가 무중단으로 완주.

**시드 & 스크립트**

- [ ] `scripts/seed-demo.ts` — WAPPLES URL + 금융 PDF 3건 + 경쟁사 PPTX 1건
- [ ] `scripts/force-change.ts` — 시드 URL `content_hash` 강제 변경 (Demo B 트리거)
- [ ] 사전 생성된 인터뷰 응답 캐시 (LLM 장애 fallback)

**리허설 환경**

- [ ] [app/demo/playback/page.tsx](app/demo/playback/page.tsx) — 백업 녹화 영상 재생
- [ ] 발표 PC에서 Chrome 단독 프로필 생성 (확장 프로그램 X)
- [ ] 데모 환경변수 분리(`SLACK_DEFAULT_CHANNEL_ID=#docmind-demo` 고정)

**리허설 통과 기준 (계획서 11장 7항목)**

- [ ] 회원가입: 도메인 화이트리스트 동작
- [ ] KB URL: WAPPLES 60초 내 ready
- [ ] KB 파일: PDF/PPTX/DOCX/XLSX 4종 ready
- [ ] 인터뷰→PPT: 슬라이드 ≥ 8장 + .pptx PowerPoint에서 열림
- [ ] 자율 루프: 30초 내 5단계 + Slack 도착 + 발행
- [ ] 스케줄(옵션): 1분 내 자동 생성
- [ ] 회복: Inngest 실패 시 step 재시도 + 빨간 칩 + Sentry 알림

**리허설**

- [ ] Demo A 단독 리허설 (총 < 3분, 3회 무중단)
- [ ] Demo B 단독 리허설 (총 < 2분, 3회 무중단)
- [ ] A→B 연속 리허설 (총 < 6분, 1회 무중단)
- [ ] 백업 녹화본 mp4 로컬 저장 + 발표장 네트워크 차단 시 USB 재생 가능

**최종 점검**

- [ ] Sentry 알람 룰 (P0: `/api/interview/*`, `/api/generate/*` 5xx)
- [ ] Supabase 콜드 쿼리 워밍 (발표 10분 전 자동 ping)
- [ ] Vercel deployment alias 고정 (`docmind-demo.vercel.app`)

---

## 16. 결정 로그

- **Supabase (Postgres + Storage + pgvector)** vs Neon + Cloudflare R2: 콜드스타트 없음 + 단일 콘솔 + pgvector 기본 활성 → Supabase. Auth.js 세션을 그대로 쓰므로 Supabase Auth는 미사용(서버에서 service role로 signed URL 발급).
- **단일 DB(pgvector)** vs Pinecone/Weaviate: 데모 규모와 단일 배포 우선 → pgvector.
- **Inngest** vs BullMQ+Redis: Vercel 친화 + step별 재시도/관찰성 → Inngest.
- **자체 슬라이드 렌더 + pptxgenjs** vs Figma MCP 직접 슬라이드 생성: 라이브 데모 안정성 우선 → 자체 렌더, Figma는 토큰 공급원.
- **Auth.js v5** vs Clerk: 외부 의존 최소 + 도메인 화이트리스트 단순 구현 → Auth.js.
- **Anthropic SDK 직접** vs Agent SDK: 단계별 제어 명확성 + Inngest와의 매핑 직관성 → SDK 직접 호출.
- **Next 16 채택** (2026-05-28): `create-next-app@latest` 가 16.2.6 설치. 15 다운그레이드 대신 16 그대로 진행. App Router/Server Actions 등 핵심 API 호환, plan 의 "Next 15" 표현은 16 으로 갱신.
- **shadcn `toast` → `sonner`** (2026-05-28): shadcn v4 에서 `toast` 컴포넌트가 deprecated, `sonner` 권장. plan 의 기본 컴포넌트 목록에서 toast 자리를 sonner 로 대체.
- **Auth.js v5 split config + JWT session strategy** (2026-05-28): Edge runtime (middleware) 에서 DB 접근 불가 → [src/auth.config.ts](../src/auth.config.ts) (providers/callbacks, Edge-safe) 와 [src/auth.ts](../src/auth.ts) (+DrizzleAdapter, Node) 로 분리. Session strategy 는 `jwt` 로 — middleware 에서 추가 DB 호출 없이 인증 판정 가능. database strategy 가 필요해지면 (예: 즉시 logout 반영) 전환.
- **Sentry `sendDefaultPii: false` 강제** (2026-05-28): `@sentry/wizard` 가 기본값 `true` 로 init 코드 생성하지만 plan §10 비기능 ("PII 는 로그에 남기지 않음") 과 정면 충돌. [sentry.server.config.ts](../sentry.server.config.ts), [sentry.edge.config.ts](../sentry.edge.config.ts), [src/instrumentation-client.ts](../src/instrumentation-client.ts) 3 파일 모두 `false` 로 변경. 향후 특정 컨텍스트만 화이트리스트하려면 `beforeSend` 에서 명시.
- **Sentry DSN 하드코딩 유지** (2026-05-28): wizard 가 3 init 파일에 DSN 을 직접 박는데 DSN 은 공개해도 무방 (Sentry 표준 권장) → 환경변수화하지 않고 하드코딩 유지. `SENTRY_DSN` env 는 unused — 향후 환경별 DSN 분기 필요 시 (`process.env.NEXT_PUBLIC_SENTRY_DSN`) 코드 갈아끼움. env 파일 주석으로 명시.
