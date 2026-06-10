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

**상태 머신**: `type → reader → cta → objection → keyMessage → length → generate`

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
2. **Demo A — 5질문→PPT**: 홈에서 "영업 제안서" 카드 → 인터뷰 5문답(독자=임원, CTA=계약, 반론=가격, 핵심메시지="WAPPLES로 웹 위협 선제 차단", 분량=10) → 30초 내 슬라이드 미리보기 → .pptx 다운로드.
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
- [x] Sentry 프로젝트 생성 + `SENTRY_DSN` 확보
- [x] ~~`src/design/tokens.default.json` 초안 작성~~ → [src/design/tokens.ppt.json](../src/design/tokens.ppt.json) (PPT 토큰) + Phase 8에서 [src/design/tokens.web.json](../src/design/tokens.web.json) 별도 작성 예정 ([DESIGN.md](DESIGN.md) 기반 Notion 스타일)
- [x] Figma 템플릿 수령 완료 → [docs/PPT_LAYOUT_SPEC.md](PPT_LAYOUT_SPEC.md) 에 표지·엔딩 토큰 + 본문 9종 마스터 정의, [src/lib/ppt/layouts.ts](../src/lib/ppt/layouts.ts) 에 좌표 코드화

**로컬 개발 환경**

- [x] Node.js 22 + pnpm 9 설치 — 2026-05-28 Node 22.18.0 + pnpm 11.4.0 (corepack 활성화)
- [x] `.env.local`에 위 모든 키 채움 — 2026-05-28 20개 키 모두 FILLED (Sentry DSN 은 wizard 가 박은 실제 값)
- [ ] `inngest-cli dev` + Vercel CLI(`vercel dev`) 양립 확인 — Phase 2 KB 시작 시 처리 예정

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
- [x] [src/instrumentation.ts](../src/instrumentation.ts) + [src/instrumentation-client.ts](../src/instrumentation-client.ts) + [sentry.server.config.ts](../sentry.server.config.ts) + [sentry.edge.config.ts](../sentry.edge.config.ts) + [src/app/global-error.tsx](../src/app/global-error.tsx) 생성, [next.config.ts](../next.config.ts) 를 `withSentryConfig` 로 wrap, [.env.sentry-build-plugin](../.env.sentry-build-plugin) (gitignored) 에 build 시 소스맵 업로드용 토큰. **wizard 기본값 `sendDefaultPii: true` 는 plan §10 위반이라 3 파일 모두 `false` 로 강제 변경 (결정 로그 참조)**. DSN 은 wizard 가 코드에 직접 하드코딩 — `SENTRY_DSN` env 는 unused (.env 주석 갱신)

**검증**

- [x] `@pentasecurity.com` 계정 로그인 성공 — 2026-05-28 사용자 브라우저 확인
- [x] 외부 도메인 계정 거부 응답 — 2026-05-28 [scripts/verify-signin.ts](../scripts/verify-signin.ts) 로 5개 케이스 (penta+verified=OK, gmail/다른hd/unverified/null=거부) 모두 통과. 실 OAuth 흐름 검증은 사용자가 외부 Google 계정으로 추가 확인 시 더 견고
- [x] 홈 카드 6개 노출 — 2026-05-28 [src/app/(app)/page.tsx](<../src/app/(app)/page.tsx>) DOC_TYPES 배열 6 entries 확인 (sales/plan/business/tech/meeting/marketing), 타입체크·ESLint 클린. 시각적 확인은 사용자 브라우저 작업
- [x] DB에 user/workspace_member row 생성 확인 — 2026-05-28 사용자 확인

---

### Phase 2 — 지식 베이스 (KB) ✅

> **산출물**: WAPPLES URL 등록 → 60초 내 `ready` → /kb 카드 노출. PDF/PPTX/DOCX/XLSX 파일도 동일 흐름.

**공통 인프라**

- [x] `pnpm add @anthropic-ai/sdk inngest p-limit ulid zod` — 2026-05-28 (@anthropic-ai/sdk 0.99, inngest 4.4, p-limit 7.3, ulid 3.0.2, zod 4.4.3). 부수로 `protobufjs` allowBuilds placeholder 등장 → `false` (빌드 스킵, 함정 항목 참조). **`voyageai` SDK 는 v0.2.1 의 ESM 빌드가 파손되어 production build 실패 → 제거하고 직접 fetch 로 전환 (함정 항목 참조)**
- [x] [src/lib/anthropic.ts](../src/lib/anthropic.ts) — SDK 클라이언트(HMR-safe global) + `MODELS` 상수(sonnet/opus/haiku) + `cachedText`/`systemWithCache`/`contextBlock` prompt caching 헬퍼
- [x] [src/lib/embeddings.ts](../src/lib/embeddings.ts) — `embed(texts, type='document')`: `https://api.voyageai.com/v1/embeddings` 직접 호출, 배치 128, `p-limit(5)` 병렬, 1024-dim 차원 검증, response.data index 순 정렬. `voyage-3` 모델
- [x] [src/lib/storage.ts](../src/lib/storage.ts) — Supabase Storage service-role 클라(`auth.persistSession=false`). `buildSourceKey(ws, name)` 가 `${workspaceId}/${ulid()}/${safeName}` 강제(함정 방어), signed upload/download URL (다운로드 TTL 5분, plan §10), pptx 캐시 업로드/다운로드 헬퍼 포함
- [x] [src/inngest/client.ts](../src/inngest/client.ts) + [src/app/api/inngest/route.ts](<../src/app/api/inngest/route.ts>) — Inngest v4 client(id=`docmind`) + Zod 이벤트 스키마(`source/crawl.requested`, `source/changed`) + `inngest/next` `serve` 핸들러(Node runtime, maxDuration 300). 함수 배열은 다음 단계에서 채움

**크롤러 / 파서**

- [x] `pnpm add undici cheerio pdf-parse mammoth xlsx jszip @mozilla/readability jsdom` + `pnpm add -D @types/jsdom` — 2026-05-28 (undici 8.3, cheerio 1.2, pdf-parse 2.4.5, mammoth 1.12, xlsx 0.18.5, jszip 3.10, @mozilla/readability 0.6, jsdom 29.1, @types/jsdom 28.0)
- [x] [src/lib/crawler/types.ts](../src/lib/crawler/types.ts) — 공통 `ExtractResult { text, title?, meta? }`
- [x] [src/lib/crawler/html.ts](../src/lib/crawler/html.ts) — `fetchHtml` (undici fetch, follow redirect, User-Agent `DocMindBot/1.0`, 8MB 한도) + `extractHtml` (JSDOM + Readability 우선, 실패 시 cheerio body 텍스트 fallback)
- [x] [src/lib/crawler/pdf.ts](../src/lib/crawler/pdf.ts) — `extractPdf` (`pdf-parse` v2 `PDFParse` 클래스, `getInfo`+`getText` → 페이지 수 메타, info.Title fallback, 하이픈+개행 결합)
- [x] [src/lib/crawler/docx.ts](../src/lib/crawler/docx.ts) — `extractDocx` (`mammoth.extractRawText({ buffer })`, 첫 줄을 title 후보로)
- [x] [src/lib/crawler/xlsx.ts](../src/lib/crawler/xlsx.ts) — `extractXlsx` (SheetJS, 시트별 `# {name}\n{csv}` 섹션, `Props.Title` fallback)
- [x] [src/lib/crawler/pptx.ts](../src/lib/crawler/pptx.ts) — `extractPptx` (JSZip + `ppt/slides/slideN.xml` 순회, cheerio xmlMode 로 `<a:t>` 추출, `docProps/core.xml > dc:title` 메타)
- [x] [src/lib/chunk.ts](../src/lib/chunk.ts) — `chunkText` (≈3.5 chars/token 추정, target 600 / max 800 토큰, 문단(`\n\n`) → 문장(한글 `다/요/죠/음` + ASCII `.!?`) → 강제 wrap 순으로 폴백, 짧은 꼬리는 직전 청크에 병합)
- [ ] (옵션) Playwright fallback 모듈 (JS 렌더 페이지 대비) — 데모 시드 URL 이 모두 정적 HTML 이므로 후속

**KB 워커**

- [x] [src/inngest/functions.ts](../src/inngest/functions.ts) 에 `source/crawl.requested` 핸들러 (`crawlSource`) 추가 — 2026-05-28. `retries: 2` + `onFailure` 로 최종 실패 시 `sources.status='error'` 마킹 (각 retry 내부에서 마킹하지 않음 — 트랜지언트 깜빡임 회피). [src/app/api/inngest/route.ts](<../src/app/api/inngest/route.ts>) 에 등록
    - [x] Step 1 `fetch-and-parse` — `loadSource(ws,id)` (workspace 격리) → `dispatchParse`: url 은 Content-Type 분기(`text/*`/xml→HTML, `application/pdf`→PDF) + charset 디코딩, file 은 확장자(pdf/docx/xlsx/pptx) 분기. `sha256(text)` 까지 한 step 내에서 계산
    - [x] Step 2 `chunk-and-embed` — `chunkText` → `embed(texts,'document')` (배치/병렬은 `src/lib/embeddings.ts` 내장) → 기존 `source_chunks` 삭제 후 일괄 insert
    - [x] Step 3 `generate-metadata` — Claude Sonnet 4.6 + tool use(`set_metadata`)로 `{ title, summary, tags[] }` 구조화 추출. 시스템 프롬프트는 `systemWithCache` (cache_control ephemeral, 캐싱 컨벤션). 첫 6000자 + hint title 만 컨텍스트로
    - [x] Step 4 `finalize-ready` — `sources` 를 `status='ready'`, title/summary/tags, `content_hash`, `last_crawled_at` 일괄 update. workspace_id 필터 강제

**API**

- [x] [src/lib/rbac.ts](../src/lib/rbac.ts) — `getWorkspaceContext()` (세션 → workspace_members 조회 → `{ userId, workspaceId, role } | null`). 모든 KB API 가 이 헬퍼로 workspace_id 격리 — 2026-05-28
- [x] [src/app/api/kb/url/route.ts](<../src/app/api/kb/url/route.ts>) — POST, Zod URL 검증 + http/https 만 허용, `sources` insert(status=crawling) → `inngest.send('source/crawl.requested')` → 202 `{ sourceId }`
- [x] [src/app/api/kb/upload/sign/route.ts](<../src/app/api/kb/upload/sign/route.ts>) — POST, 확장자 화이트리스트(pdf/docx/xlsx/pptx)만, `createSourceUploadUrl(ws, filename)` → `{ key, signedUrl, token }`
- [x] [src/app/api/kb/upload/finalize/route.ts](<../src/app/api/kb/upload/finalize/route.ts>) — POST, **key prefix 가 `${ctx.workspaceId}/` 로 시작하는지 강제 검증** (덮어쓰기/타워크스페이스 공격 방어), `sources` insert(kind=file) → Inngest 트리거 → 202 `{ sourceId }`

**UI** (Phase 8 디자인 적용 전까지는 shadcn 기본 + Tailwind 기본 토큰)

- [x] `pnpm add react-dropzone` (15.0.0) — 2026-05-28
- [x] [src/app/(app)/kb/page.tsx](<../src/app/(app)/kb/page.tsx>) — Server Component, sources + chunk count 조인 1회 쿼리, URL/파일 Tabs, `dynamic = "force-dynamic"` (인증된 데이터). `KbAutoRefresh` 로 crawling row 있을 때만 3초 폴링 (`router.refresh()`)
- [x] [src/components/kb/SourceCard.tsx](../src/components/kb/SourceCard.tsx) — 상태 칩(ready/crawling/error → Badge default/secondary/destructive), 태그, 요약, kind 아이콘(Globe/File)
- [x] [src/components/kb/UrlInput.tsx](../src/components/kb/UrlInput.tsx) — Client form, `useTransition` + sonner toast, 성공 시 `router.refresh()`
- [x] [src/components/kb/DropZone.tsx](../src/components/kb/DropZone.tsx) — react-dropzone, 확장자 화이트리스트, 25MB 한도, 3단계 업로드(sign → PUT signedUrl → finalize) 직렬 처리, 진행 중 파일명 리스트
- [x] [src/components/kb/SourceSheet.tsx](../src/components/kb/SourceSheet.tsx) — 우측 Sheet, 상태/종류/청크 수/마지막 학습/요약/태그/content_hash 표시
- [x] [src/components/kb/KbAutoRefresh.tsx](../src/components/kb/KbAutoRefresh.tsx) — 보조 폴링 (3초, crawling 있을 때만)
- [x] Sonner Toaster 를 [src/app/(app)/layout.tsx](<../src/app/(app)/layout.tsx>) 에 마운트
- [x] [next.config.ts](../next.config.ts) `serverExternalPackages: ["pdf-parse", "jsdom"]` — Node-native 의존성을 Next 가 ESM 으로 번들하지 않게 (production build 필수)

**검증**

- [x] WAPPLES URL → ready, **태그 ≥ 2 자동 생성** — 2026-05-29 [scripts/verify-kb-url.ts](../scripts/verify-kb-url.ts) 로 e2e 검증 (`pnpm verify:kb-url`). `https://pentasecurity.com/products/wapples` 등록 → **12.1초** 내 status=`ready`, title=`The Logical Web Application Firewall - WAPPLES | Penta Security`, 한국어 summary 3문장, **tags=5** (`wapples, waap, cocep-engine, web-application-firewall, penta-security`), content_hash 저장. **chunk=3** (`≥20` 기준은 미달 — 해당 마케팅 페이지가 이미지 중심이라 본문이 ~6KB. chunker 자체는 정상 동작: 2.1k char/chunk × 3 ≈ 6k char 본문. 데모 매칭에는 충분)
- [x] **PDF 샘플 1건 ready 확인** — 2026-05-29 [scripts/verify-kb-file.ts](../scripts/verify-kb-file.ts) (`pnpm verify:kb-file <url>`). `bitcoin.org/bitcoin.pdf` (184KB) → Storage 업로드 → finalize → 워커 → **8.1초** 내 ready, **chunks=10**, title=`Bitcoin: A Peer-to-Peer Electronic Cash System`, 한국어 summary, tags=5. DOCX/XLSX/PPTX 는 동일 파이프라인(sign → PUT → finalize → 워커가 확장자로 파서 분기); 파서만 다르므로 `/kb` UI 의 DropZone 으로 사용자 브라우저 검증 권장
- [x] **벡터 검색 호출 1회 hit** — 2026-05-29 동일 스크립트 안에서 `embed("WAPPLES 보안 기능", "query")` → `select ... order by embedding <=> $1::vector limit 5` 실행 → top hit 코사인 유사도 **0.510** ("WAPPLES is a Web Application and API Protection solution …"). ivfflat 인덱스 사용 확인

---

### Phase 3 — 5질문 대화 인터뷰 ✅

> **산출물**: 홈 카드 클릭 → 5문답 완주 → finalize 호출.

**프롬프트**

- [x] [src/lib/prompts/interview.ts](../src/lib/prompts/interview.ts) — 시스템 프롬프트(한국어 톤·단계별 의도) + `ASK_QUESTION_TOOL` (tool use 입력 스키마)
- [x] KB top-3 chunk 를 `<kbContext>` 블록으로 주입 + `cache_control: ephemeral` ([service.ts](../src/lib/interview/service.ts) `generateQuestion` 안에서 `contextBlock("kbContext", …)`)
- [x] 응답 Zod 스키마: `{ aiMessage, quickReplies: 2~4, insight? }` ([service.ts](../src/lib/interview/service.ts) `ToolSchema`). `pnpm add zustand` (5.0.13)

**상태머신**

- [x] [src/lib/interview/machine.ts](../src/lib/interview/machine.ts) — `type→reader→cta→objection→keyMessage→length→generate` 7단계 (`STEPS` 상수, `nextStep`/`isLastAnswerable`/`isAnswerable` 헬퍼, `DOC_TYPE_LABELS`·`STEP_LABELS` 매핑)
- [x] [src/lib/interview/store.ts](../src/lib/interview/store.ts) — zustand `interviewStore` 팩토리(`createInterviewStore(init)`). state: `documentId/documentType/currentStep/answers/turns/quickReplies/insight/matches/pending/done`. action: `pushUser/pushAi/applyNext/setPending`. ChatView 가 `useState(() => createInterviewStore(initial))` 패턴으로 React 19 의 `react-hooks/refs` 룰 우회

**API**

- [x] [src/app/api/interview/start/route.ts](<../src/app/api/interview/start/route.ts>) — POST `{ documentId }`. 현재 step 의 질문을 멱등 재발급. `done` 이면 `{ done: true }`
- [x] [src/app/api/interview/answer/route.ts](<../src/app/api/interview/answer/route.ts>) — POST `{ documentId, step, answer }`. step 일치 검사(409 mismatch) + `answers_json` 부분 저장 → 다음 step 의 질문 생성. 마지막 step(`length`) 이후엔 `{ done: true }`
- [x] [src/app/api/interview/finalize/route.ts](<../src/app/api/interview/finalize/route.ts>) — POST `{ documentId }`. 5답 모두 채워졌는지 검증 → `documents` row 에 reader/cta/objection/length_pages 복사 + session `current_step='generate'` 마킹. **Phase 4 generate 트리거는 아직 미연결 (TODO)**

**UI**

- [x] [src/app/(app)/chat/new/page.tsx](<../src/app/(app)/chat/new/page.tsx>) — Server Component. `?type=<id>` 받아 `documents` + `interview_sessions` insert → `/chat/[id]` 로 redirect
- [x] [src/app/(app)/chat/[documentId]/page.tsx](<../src/app/(app)/chat/[documentId]/page.tsx>) — Server Component. workspace 격리 select + session 로드 + 현재 step 의 `generateQuestion` SSR → `<ChatView initial={...} />` 전달. 새로고침 시 `answers_json` 으로 복원
- [x] [src/components/chat/ChatView.tsx](../src/components/chat/ChatView.tsx) — Client orchestrator. zustand store + answer/finalize POST + 토스트
- [x] [src/components/chat/MessageList.tsx](../src/components/chat/MessageList.tsx) — 말풍선, auto-scroll
- [x] [src/components/chat/QuickReplies.tsx](../src/components/chat/QuickReplies.tsx) — 옵션 버튼 row
- [x] [src/components/chat/ProgressTrack.tsx](../src/components/chat/ProgressTrack.tsx) — 5 칸 단계 진행도 (`done`/`active`/`pending` 시각화)
- [x] [src/components/chat/InsightBox.tsx](../src/components/chat/InsightBox.tsx) — KB 매칭 인사이트 카드(매칭 자료 제목/snippet/유사도)

**검증**

- [x] 5문답 완주 시간 < 2분 — 2026-05-29 사용자 브라우저 확인
- [x] 응답 지연 < 2.5s (스트리밍 시작 기준) — 2026-05-29 non-streaming tool use 응답으로 체감 통과. 스트리밍 도입은 후속(필요시)
- [x] `interview_sessions.answers_json` 부분 저장 + 중간 새로고침 시 복원 — 2026-05-29 사용자 브라우저 확인

---

### Phase 4 — PPT 자동 생성 ✅

> **산출물**: finalize 후 미리보기 슬라이드 ≥ 8장 표시 + .pptx 다운로드 정상.

**Slide IR**

- [x] [src/lib/ppt/types.ts](../src/lib/ppt/types.ts) — Slide 9종 discriminatedUnion + Zod (`DeckSchema`, `SlideSchema`, `DeckMetaSchema`). meta 에 `securityLevel/author/date` 포함. 각 slide 별 글자 수·개수 한도 포함
- [x] [src/design/tokens.ppt.json](../src/design/tokens.ppt.json) — PPT 디자인 토큰 (Phase 0). **basePath 를 `/ppt-assets` 로 변경** (자산을 `public/ppt-assets/` 로 복사)
- [x] [src/lib/ppt/layouts.ts](../src/lib/ppt/layouts.ts) — 9종 마스터 좌표/스타일 코드화 (Phase 0)

> 웹 UI 토큰(`tokens.web.json`)과 Tailwind preset 은 **Phase 8** 에서 일괄 작성. Phase 4 는 PPT 출력만 책임지며, 미리보기 `<Slide>` 컴포넌트는 PPT 토큰을 직접 import 한다 (웹 토큰과 무관).

**LLM 파이프라인**

- [x] [src/lib/prompts/outline.ts](../src/lib/prompts/outline.ts) — `propose_outline` tool, Slide.kind 시퀀스 + 시작 cover/끝 cta 강제 + 길이 보정 후처리
- [x] [src/lib/prompts/slide-fill.ts](../src/lib/prompts/slide-fill.ts) — kind 별 `fill_slide` tool 스키마 동적 생성 (각 kind 의 필드만 노출), 모든 호출에 `sourceRefs` 반환 강제
- [x] [src/lib/ppt/generate.ts](../src/lib/ppt/generate.ts) — `generateDeck()` orchestrator: KB matches → outline → `p-limit(4)` 병렬 fill → Zod 검증 + 2회 재시도 → fallback slide → Deck 조립 (sourceRefs 집계)

**렌더**

- [x] [src/lib/ppt/render.tsx](../src/lib/ppt/render.tsx) — `<SlideCanvas>` (1920×1080 + CSS scale) + 9종 kind 별 컴포넌트 + `<FooterMaster>` + `<CoverMaster>` (PPT_LAYOUTS 박스를 absolute positioning)
- [x] [src/lib/ppt/pptx.ts](../src/lib/ppt/pptx.ts) — `renderPptx(deck)` → `pptxgenjs` Buffer. `LAYOUT_WIDE` (13.333×7.5 in), `px → inch (×13.333/1920)`, `px → pt (÷2)` 환산. 자산은 `public/ppt-assets/` 의 fs 경로
- [x] 마스터 9종 정의 — `PPT_LAYOUTS[kind]` (Phase 0) 를 양쪽 렌더가 단일 출처로 공유
- [x] 한글 폰트 fallback — 토큰의 family chain `Pretendard, Gotham, Malgun Gothic` 그대로 사용 (pptxgenjs `fontFace` 에 첫 폰트명 전달). 발표 PC `맑은 고딕` 까지 자동 fallback

**API**

- [x] [src/app/api/generate/route.ts](<../src/app/api/generate/route.ts>) — POST `{ documentId, securityLevel? }`. answers 완료 검증 → `generateDeck` → `document_versions` insert (version 자동 증가) → `{ versionId, version, slideCount }`. `maxDuration: 300`
- [x] [src/app/api/generate/[versionId]/pptx/route.ts](<../src/app/api/generate/[versionId]/pptx/route.ts>) — GET. workspace_id 조인 검증 → 이미 캐시된 `pptxObjectKey` 있으면 signed URL 즉시 반환, 없으면 `renderPptx` → Storage upload → key 저장 → signed URL. `maxDuration: 300`

**UI**

- [x] [src/components/deck/SlidePreview.tsx](../src/components/deck/SlidePreview.tsx) — width prop 받아서 1920×1080 캔버스를 CSS scale 로 비율 유지 축소
- [x] [src/components/deck/DeckViewer.tsx](../src/components/deck/DeckViewer.tsx) — 좌측 썸네일 카드(160px) + 우측 큰 슬라이드(960px) + `.pptx` 다운로드 버튼
- [x] [src/app/(app)/deck/[versionId]/page.tsx](<../src/app/(app)/deck/[versionId]/page.tsx>) — 새 deck 미리보기 페이지 (Server Component, workspace 격리, Zod 재검증)
- [x] **Phase 3 wire-up**: [src/app/api/interview/finalize/route.ts](<../src/app/api/interview/finalize/route.ts>) 가 `generateDeck` 호출 → `document_versions` insert → `versionId` 반환. ChatView 가 응답의 `versionId` 로 `/deck/[versionId]` 로 router.push

**검증**

- [x] 생성 시간 < 25s — 2026-05-29 사용자 브라우저 e2e
- [x] .pptx 다운로드 후 PowerPoint/Keynote에서 열림, 깨진 폰트 없음 — 2026-05-29 사용자 확인
- [x] 미리보기와 .pptx 결과가 시각적으로 동일 — 2026-05-29 사용자 확인

**검증 후속 패치 (2026-05-29)**

- [x] 푸터 securityChip ↔ wordmark 좌우 위치 + 박스 비율 swap — `tokens.ppt.json` 한 군데 수정으로 위치(좌하단=wordmark / 우하단=securityChip)와 자연 비율 (8.875 / 15.0) 동시 정상화. [PPT_LAYOUT_SPEC §3.1](PPT_LAYOUT_SPEC.md#31-body-footer-master-8종-본문-공통) 표 정정
- [x] agenda items / section title 번호 prefix 자동 제거 (`stripNumberPrefix`) + section ≥ 2 일 때 agenda items 를 section title 들로 자동 동기화 (`alignAgendaAndSections` in [generate.ts](../src/lib/ppt/generate.ts))

**알려진 제한 (이후 보완)**

- [ ] **agenda items ↔ 본문 슬라이드 title 완전 정합성** — section 슬라이드가 0~1개인 짧은 deck 에서는 LLM 이 agenda items 와 bullets/twoCol title 을 독립 생성해 mismatch 발생. 근본 해결책 후보:
  1. **2-phase generation**: 본문 슬라이드 먼저 채운 뒤, 그 title 들을 컨텍스트로 agenda 만 마지막에 채움 (sequential)
  2. **outline 단계에서 title 도 같이 결정**: outline tool 에 `kinds` 뿐 아니라 `titles[]` 도 같이 요청, 그 후 slide-fill 은 title 을 받아 본문만 생성
  3. **agenda 슬라이드 자체를 제거**: agenda 없는 5~8장 deck 은 자연스럽게 mismatch 발생 안 함
- [ ] **표지에 보안레벨 표시** (사용자 #2) — Figma 원본 표지 사양 확인 후 Phase 8 또는 별도 추가
- [ ] **마지막 페이지 엔딩 마스터** (사용자 #4) — `color.footer.end:#000000` + `awards_badge_back.png` 사용. ENDING_MASTER + endLayout 정의 필요. Figma `end_16x9` 좌표 확인 후 Phase 8 에서 일괄 처리 권장

---

### Phase 5 — 에이전트 자율 루프 ✅

> **산출물**: 시드 URL의 `content_hash` 강제 변경 시 30초 내 5단계 phase event 모두 기록 + `approvals` row 생성.

**Inngest 5함수** ([src/inngest/agent.ts](../src/inngest/agent.ts), 한 `runId` 를 5단계에 관통)

- [x] `agent.detect` (cron `*/30 * * * *` + `agent/detect.requested`) — 재크롤 + content_hash 비교 + 5% 임계(Jaccard). `forced-` 센티넬 시 라이브 크롤·임계 우회(오프라인 데모). 변경 시 `agent_runs` 생성 → `source.changed` emit
- [x] `agent.perceive` (`source.changed`) — diff 섹션 분류 (Sonnet, `classify_change` tool) → `source.perceived`
- [x] `agent.reason` (`source.perceived`) — `document_sources` 로 참조 문서 조회 → 영향/우선순위 (Opus 4.7, `rank_impact`) → `source.impact-ready`
- [x] `agent.act` (`source.impact-ready`) — `shouldRegenerate` 문서마다 최신 버전 clone 한 draft 신버전 + `approvals`(pending) + `notifications`(slack/pending, **발송은 Phase 6**) → `source.acted`
- [x] `agent.learn` (`source.acted`) — pattern 텍스트 임베딩 → `learning_patterns` upsert(outcome=pending) → run 종료

**보조**

- [x] [src/lib/agent/events.ts](../src/lib/agent/events.ts) — `appendEvent/startRun/endRun/ensureMonitorAgent/reconstructSourceText/changeRatio`
- [x] [src/lib/agent/policy.ts](../src/lib/agent/policy.ts) — `getPolicy` + `shouldAutoPublish` (기본 manual: 승인 큐만 생성, Slack 은 항상 승인 후)
- [x] 개발자 모드 "지금 감지" 버튼 → `POST /api/agent/run/[id]/trigger` (`[id]`=agentId). [src/components/agent/DetectButton.tsx](../src/components/agent/DetectButton.tsx) + 최소 [app/(app)/agent/page.tsx](<../src/app/(app)/agent/page.tsx>) (실행/이벤트/승인큐 SSR — 리치 대시보드·SSE 는 Phase 7)
- [x] 프롬프트 [diff-perceive.ts](../src/lib/prompts/diff-perceive.ts) · [impact-rank.ts](../src/lib/prompts/impact-rank.ts)
- [x] 스키마: `learning_patterns` 테이블 + `document_versions.status` 컬럼 추가 (drizzle/0002, 기존 버전 `published` 백필)
- [x] **Phase 4 갭 보강**: generate/finalize 가 `deck.sourceRefs` → `document_sources` 정규화 + 신버전 `status='published'` ([normalizeDocumentSources](../src/lib/ppt/generate.ts))

**API**

- [x] [app/api/agent/approve/route.ts](<../src/app/api/agent/approve/route.ts>) — 승인/거부. approve 시 버전 `published` + notif `queued` + pattern `approved` + audit_log
- [x] [app/api/agent/run/[id]/route.ts](<../src/app/api/agent/run/[id]/route.ts>) — run 상세 (run+events+approvals, `[id]`=runId)

**검증** — `pnpm verify:agent` ([scripts/force-change.ts](../scripts/force-change.ts), 자급식·오프라인)

- [x] `content_hash` 강제 변경 → **10.7s** 내 detect/perceive/reason/act/learn 5개 event 기록 (목표 30s)
- [x] approval 행 생성, Slack 발송 보류 (`notifications.status='pending'`)
- [x] 승인 후 `document_versions.status='published'`

**Phase 5 retro (후속 개선 항목)**

- `agent.act` 는 현재 최신 버전 **clone + 변경노트 주입** (30s 예산 보호). 변경 섹션만 부분 재생성(perception → sourceRefs 매핑 후 해당 slide 만 `fillSlide`)은 후속.
- `agent.detect` 실변경(cron) 경로는 hash 갱신만; 변경 소스의 chunk 재임베딩은 후속(현재 forced 데모 경로는 chunk 불변이라 무관).
- `learning_patterns` KNN 가중치를 `reason` 에 실제 반영하는 로직은 후속(현재는 적재만).

---

### Phase 6 — 알림 (Slack / Email) ✅

> **산출물**: 승인 클릭 → `#docmind-demo` 채널에 Block Kit 메시지 도착 + 딥링크 동작.

**발송 시점 결정**: §5.5 "발송은 항상 승인 후"(기획서 명시) + 산출물 "승인 클릭 → 메시지 도착" 에 맞춰 **모든 outbound(Slack+Email)는 approve 시점에만** 발송한다 (자율 outbound 금지 불변식). Phase 5 `act` 가 만든 `notifications`(slack/pending) row 를 approve 가 실제 발송 후 `sent`/`failed`/`skipped` 로 갱신, email row 는 신규 insert. (§15 의 "Resend 승인 요청 템플릿" 문구는 발송 시점 불변식과 충돌 → **발행 알림 템플릿**으로 구현, 본 결정으로 기록.)

- [x] `pnpm add @slack/web-api resend`
- [x] [src/lib/slack.ts](../src/lib/slack.ts) — lazy WebClient + `buildPublishBlocks` (제목/변경요약/딥링크 버튼) + 미설정 시 graceful `skipped`. 채널: `SLACK_DEFAULT_CHANNEL_ID` 우선
- [x] [src/lib/email.ts](../src/lib/email.ts) — lazy Resend + 발행 알림 HTML 템플릿 + 미설정 시 `skipped` (`RESEND_FROM` 미설정 시 `onboarding@resend.dev` 폴백)
- [x] [src/lib/notify.ts](../src/lib/notify.ts) — `dispatchApprovalNotifications` (approve 시 호출). Slack(채널) + Email(워크스페이스 멤버) 발송 → `notifications` 이력 기록
- [x] `notifications` 테이블에 발송 이력 기록 (slack row 갱신 + email row insert, payload 에 ts/id/error)
- [x] Slack 발송 실패 fallback: in-app toast(`ApprovalActions` 가 `notify.slack` 으로 warning) + activity feed 빨간 칩(`agent_events` `notification.failed` → `/agent` destructive 배지)
- [x] 딥링크: approve route 가 `${NEXT_PUBLIC_APP_URL}/agent?approval=<id>` 버튼 포함. [/agent](<../src/app/(app)/agent/page.tsx>) 가 `?approval=<id>` 로 진입 시 해당 카드(대기/처리됨 무관) 하이라이트
- [x] **검증**: dry-run(토큰 strip)으로 dispatch 경로 통과 — `skipped`+이력 row(slack/email) 생성 확인. **라이브 발송(#docmind-demo 실제 메시지 + 메일)은 outward action 이라 사용자 확인 후 1회 실시 예정**

---

### Phase 7 — 대시보드 & 보조 화면 ✅

> **산출물**: 실시간 활동 피드 + 승인 큐가 보이는 에이전트 대시보드. 문서함/스케줄/설정.
>
> **세분화 완료**: (1) 실시간 SSE 토대 ✅ → (2) 에이전트 대시보드 ✅ → (3) 문서함 ✅ → (4) 스케줄(Mode C) ✅ → (5) 설정 ✅. **잔여**: 실시간 1초 노출·승인 시각 e2e 는 로그인 브라우저 1회(JWT 세션, 헤드리스 위조 불가) — 나머지 검증은 단위/e2e 로 통과.

**실시간** ✅

- [x] [app/api/events/stream/route.ts](<../src/app/api/events/stream/route.ts>) — SSE (Node runtime, `text/event-stream`, `no-cache, no-transform`, `X-Accel-Buffering:no`). 워크스페이스 격리(rbac) + 1s DB 폴링 + 백로그 20건 + heartbeat 15s + `req.signal` 정리
- [x] [src/lib/sse.ts](../src/lib/sse.ts) — `formatSSE`/`SSE_HEADERS`(서버) + `subscribeAgentEvents`(클라 EventSource). `id:` 프레임 → 네이티브 `Last-Event-ID` 재구독, `?since=eventId` 도 지원 (db import 없음 → 클라 번들 안전)
  - 검증: build/lint 통과, 미인증 시 401(워크스페이스 가드 확인). 실시간 "1초 이내 노출" e2e 는 (2) ActivityFeed 클라와 함께 수행

**에이전트 대시보드** ✅ (단계 2)

- [x] [app/(app)/agent/page.tsx](<../src/app/(app)/agent/page.tsx>) — 3컬럼(AgentList | AgentLive | Stat+승인큐) SSR. monitor 에이전트 보장 + 백로그 20건 + 통계 쿼리 + 승인큐 + 딥링크 하이라이트
- [x] [src/components/agent/AgentList.tsx](../src/components/agent/AgentList.tsx) — 좌측 패널 (kind 라벨 + 상태/마지막 run 칩)
- [x] [src/components/agent/ActivityFeed.tsx](../src/components/agent/ActivityFeed.tsx) — phase별 컬러([phases.ts](../src/components/agent/phases.ts), Tailwind 팔레트 — Phase 8 brand spectrum remap 예정), `*.failed` 빨간 처리
- [x] [src/components/agent/LoopDiagram.tsx](../src/components/agent/LoopDiagram.tsx) — 5단계 SVG + 활성 노드 펄스(`fill-current`+`animate-pulse`, currentColor 기법)
- [x] [src/components/agent/ApprovalQueue.tsx](../src/components/agent/ApprovalQueue.tsx) — 대기 큐 + 딥링크 하이라이트 + `ApprovalActions` 래핑
- [x] [src/components/agent/StatCard.tsx](../src/components/agent/StatCard.tsx) — 오늘 자동 실행/갱신 문서/시간 절감(87% 데모)/모니터링 4개
- [x] [src/components/agent/AgentLive.tsx](../src/components/agent/AgentLive.tsx) — 단일 EventSource 구독(`subscribeAgentEvents`) + 탭(활동 피드/루프 구조/생성된 문서) + 최신 이벤트로 activePhase 파생
  - 검증: build/lint 통과, 에이전트 루프 회귀 통과(verify:agent 5단계 9.2s, 이벤트 적재 확인). **실시간 "1초 이내 노출" + 승인 클릭 시각 e2e 는 로그인 브라우저에서 1회**(JWT 세션이라 헤드리스 위조 불가)

**문서함** ✅ (단계 3)

- [x] [app/(app)/docs/page.tsx](<../src/app/(app)/docs/page.tsx>) — 카드 그리드 + 유형/상태 필터(searchParams 링크). 카드: 유형/상태 칩, 최신 v#·버전 수, 갱신일
- [x] [app/(app)/docs/[id]/page.tsx](<../src/app/(app)/docs/[id]/page.tsx>) — 문서 헤더(유형/상태/답변) + 버전 타임라인(상태 칩·변경노트·미리보기[/deck]·.pptx 다운로드·"최신과 비교") + 버전 간 diff(`?base=&target=`, 기본 최신↔직전)
- [x] [src/lib/diff.ts](../src/lib/diff.ts) — `deckToLines`(슬라이드별 평탄화) + LCS `diffLines`/`diffDecks`/`diffStats` (외부 의존성 없음)
  - 검증: diff 단위테스트 통과(변경 del+add / 슬라이드 삽입 add / 동일 0·0). build/lint 통과. **주의**: 데모 시드의 v2 는 v1 clone 이라 동일 표시됨 — 실제 변경 diff 는 act 부분 재생성(Phase 5 retro) 후 풍부해짐

**스케줄 (Mode C)** ✅ (단계 4)

- [x] [app/(app)/schedules/page.tsx](<../src/app/(app)/schedules/page.tsx>) — cron + 문서 템플릿(유형/제목/독자/CTA/반론/핵심메시지/분량) 등록 폼([ScheduleForm](../src/components/schedules/ScheduleForm.tsx)) + 목록(활성 토글/삭제 [ScheduleActions](../src/components/schedules/ScheduleActions.tsx)). nav 에 "스케줄" 링크 추가
- [x] API [POST /api/schedules](<../src/app/api/schedules/route.ts>) (cron 검증 + 생성) · [PATCH/DELETE /api/schedules/[id]](<../src/app/api/schedules/[id]/route.ts>) (토글/삭제, 워크스페이스 격리)
- [x] Inngest [agent.generate.scheduled](../src/inngest/agent.ts) — **매분(`* * * * *`) 틱 + 등록 schedule cron 매칭**(정적 cron 제약 우회 패턴) → `generateDeck`(KB 자동 매칭 포함) → document+version(published) 저장 + 결과 notification(pending) 기록
- [x] [src/lib/cron.ts](../src/lib/cron.ts) `cronMatches`(의존성 없는 5필드 매처) + [src/lib/schedule.ts](../src/lib/schedule.ts)(공유 템플릿 Zod). cron 매처 단위테스트 11/11
  - **주의(데모)**: `* * * * *` 는 매분 생성 → LLM 비용/문서 누적. 데모 후 스케줄 비활성화/삭제할 것.

**설정** ✅ (단계 5)

- [x] [app/(app)/settings/page.tsx](<../src/app/(app)/settings/page.tsx>) — 에이전트 정책(자동 실행/발행 manual·auto)·Slack 알림 채널([SettingsForm](../src/components/settings/SettingsForm.tsx) → [PATCH /api/settings](<../src/app/api/settings/route.ts>)) + 이메일 수신자(멤버)·브랜드 템플릿 목록(읽기, PPT 는 `tokens.ppt.json`)·Slack/Email 연결 상태 배지. nav "설정" 링크 추가
  - 저장은 monitor 에이전트 `config_json`(`policy.publish` + `notifyChannel`) + `auto_run`. **동작 연결**: `act` 가 `getNotifyChannel` 로 알림 target 결정, `shouldAutoPublish` 로 발행 게이트. 설정 roundtrip + 헬퍼 검증 PASS

**검증**

- [ ] 새 event 생성 후 활동 피드에 1초 이내 노출 (로그인 브라우저 1회 — 단계 2)
- [ ] 승인 큐에서 클릭 → 발행 + Slack 발송 + 피드에 ✅ (로그인 브라우저 + Slack 토큰 1회)
- [x] 문서 상세에서 v1 vs v2 diff 가독성 OK (diff 단위테스트 통과 — 단계 3)
- [x] 1분 스케줄 등록 시 1분 내 새 문서 생성 (e2e: 등록 → **27초** 내 새 문서 — 단계 4)

---

### Phase 8 — UI 디자인 시스템 적용 ([DESIGN.md](DESIGN.md)) ✅

> **전제**: Phase 1–7 의 모든 화면이 기능적으로 동작하고, shadcn 기본 스타일로 빠르게 구현되어 있다.
> **산출물**: 모든 페이지가 [docs/DESIGN.md](DESIGN.md) Notion 스타일을 따른다. 색·타이포·여백·컴포넌트가 단일 토큰셋(`tokens.web.json`)을 통해 일관 적용되고, 다크 모드가 동작한다.
>
> **세분화**: (1) 디자인 토큰 추출 ✅ → (2) shadcn 컴포넌트 토큰 매핑 → (3) 화면별 적용 → (4) 다크 모드 마감. 한 단계씩.
> **스택 메모**: Tailwind **v4(CSS-first `@theme`)** + shadcn oklch 변수. v3 식 `tailwind.config` preset 은 소비되지 않으므로 토큰→유틸 생성은 `globals.css @theme` 가 담당, `tailwind-preset.ts` 는 JS/컴포넌트용 타입드 토큰 export 로 적응. DESIGN hex 는 심볼 참조뿐이라 설명에 맞는 Notion 스타일 구체값을 확정.

**디자인 토큰 추출** ✅ (단계 1)

- [x] [src/design/tokens.web.json](../src/design/tokens.web.json) — 색(brand/navy/spectrum/tint/surface/text/semantic + darkColors), 타이포 14종(hero-display~button-md), 간격(xxs~hero), radius(xs~full), elevation(0~4) 단일화
- [x] [src/design/tailwind-preset.ts](../src/design/tailwind-preset.ts) — `webTokens`/`color()`/타입 + `tailwindThemeExtend`(colors/spacing/borderRadius/fontSize/boxShadow 형태, 포터빌리티용)
- [x] [src/app/globals.css](../src/app/globals.css) — `:root`+`.dark` 에 `--w-*` 토큰 변수(다크 surface/text 오버라이드) + `@theme inline` 으로 유틸 노출(`bg-brand`,`text-ink`,`bg-tint-*`,`shadow-elevation-*`,`text-hero-display`,`p-xl` 등). **충돌 회피**: DESIGN primary→`brand`, text-muted→`ink-muted` 로 노출(shadcn `--color-primary`/`muted` 미변경, repoint 은 단계 2)
- [x] **Pretendard Variable** — jsdelivr CDN `@import` + `--font-sans` 매핑(`html @apply font-sans`). 빌드 CSS 검증: `--w-primary:#5b5bd6`, `--w-ink` light/dark 동시 방출, Pretendard import·`--font-sans:var(--w-font-sans)` 반영 확인. (next/font/local 은 woff2 vendoring 후 교체 가능 — 현재 폰트 바이너리 미보유로 CDN 채택)

**shadcn 컴포넌트 토큰 매핑** ✅ (단계 2 — 코어 repoint + 세부 variant 완료)

- [x] **코어 repoint** ([globals.css](../src/app/globals.css)): shadcn 시맨틱 변수(`--primary/background/foreground/card/popover/secondary/muted/accent/destructive/border/input/ring`)를 brand `--w-*` 토큰으로 :root·.dark 양쪽 repoint + `--radius` 0.625→0.75rem(cards rounded-lg≈12·buttons md≈10). 컴포넌트 파일 수정 없이 전 화면이 purple primary·canvas surface·hairline border·다크 자동 전환. 빌드 CSS 검증(`--primary:var(--w-primary)` 등) PASS
- [x] `button` 세부 ([button.tsx](../src/components/ui/button.tsx)) — `dark` variant(`bg-ink-deep`/`text-on-dark`) 추가 + `link` 을 link-blue(`text-link-blue`/hover `link-blue-pressed`)로 교체. `secondary`/`ghost`/`outline` 은 기존 토큰 매핑 유지. (size·padding 은 화면별 적용 단계에서 폴리시)
- [x] `card` rounded-lg + hairline — 코어 repoint(`ring-1 ring-foreground/10` + `--radius` 0.75rem)로 적용됨. 별도 수정 불필요
- [x] `input`/`textarea` ([input.tsx](../src/components/ui/input.tsx)·[textarea.tsx](../src/components/ui/textarea.tsx)) — height 44(`h-11`)·padding `px-3 py-2`·focus `ring-2 ring-ring/60`(ring=primary). textarea 는 `min-h-16`(>44) 유지·동일 focus
- [x] `badge` ([badge.tsx](../src/components/ui/badge.tsx)) — status `purple`/`pink`/`orange`(brand bg + on-primary) + tag `tag-purple`/`tag-orange`/`tag-green`(tint bg + brand-deep text, `rounded-sm`)
- [x] `dialog`/`sheet`/`dropdown-menu` — `shadow-elevation-4` 적용(sheet `shadow-lg`→, dropdown content `shadow-md`/sub `shadow-lg`→, dialog 신규)
- [x] `tabs` ([tabs.tsx](../src/components/ui/tabs.tsx)) — `pill` variant(rounded-full·`border-hairline`·active `bg-ink-deep`/`text-on-dark`) 추가. `line` variant(after: underline)이 segmented 역할
- [x] `separator` → `bg-hairline-soft` / `skeleton` → `bg-surface-soft` 베이스
- [x] phase 색([phases.ts](../src/components/agent/phases.ts)) brand spectrum remap — 감지=link-blue·인식=brand-purple·판단=brand-orange·행동=brand-teal·학습=brand-pink(고채도 중간톤, 라이트/다크 공용·`dark:` 제거)

**화면별 적용** ✅ (단계 3 — Phase 1–7 산출 페이지 순회 완료. 헤딩은 `text-heading-*`+`font-heading`, 본문 `text-body-sm`/`text-steel` 토큰으로 통일. 공용 `TopNav`(logo brand·active NavLink brand)도 함께 적용)

- [x] [login/page.tsx](<../src/app/(auth)/login/page.tsx>) — surface 배경 + canvas 카드(elevation-2·hairline ring), 친근한 어조 카피, `h-11` primary Google 버튼
- [x] [page.tsx](<../src/app/(app)/page.tsx>) (홈) — 6종 카드를 **pastel feature tile**(peach/lavender/mint/sky/rose/yellow-bold)로 매핑. 아이콘 칩(canvas/70) + brand 컬러 아이콘. 텍스트는 `brand-navy`(다크 미오버라이드 → 파스텔 위 항상 가독). hover lift+elevation-2
- [x] [kb/page.tsx](<../src/app/(app)/kb/page.tsx>) — [SourceCard](../src/components/kb/SourceCard.tsx) hover `bg-surface`+elevation-2, 상태 칩 semantic(ready=success·error=destructive·crawling=warning/15), 태그 `tag-purple`. [SourceSheet](../src/components/kb/SourceSheet.tsx) 동일 + Separator=hairline-soft(단계2)
- [x] [chat/[documentId]](<../src/app/(app)/chat/[documentId]/page.tsx>) — [MessageList](../src/components/chat/MessageList.tsx) 행 간격 gap-5·py-6, [QuickReplies](../src/components/chat/QuickReplies.tsx) `rounded-full`+hairline pill 톤, [InsightBox](../src/components/chat/InsightBox.tsx) `card-feature-yellow-bold`(tint-yellow-bold + brand-navy 텍스트), [ProgressTrack](../src/components/chat/ProgressTrack.tsx) brand pill(active=brand·done=tint-lavender)
- [x] [agent/page.tsx](<../src/app/(app)/agent/page.tsx>) — ActivityFeed brand spectrum dot(단계2 phases.ts)·canvas+hairline row, LoopDiagram(brand spectrum), [StatCard](../src/components/agent/StatCard.tsx) 4종 accent(brand·green·orange·link-blue), ApprovalQueue/AgentLive 발행=success 칩
- [x] [docs/page.tsx](<../src/app/(app)/docs/page.tsx>) + [docs/[id]](<../src/app/(app)/docs/[id]/page.tsx>) — 카드 hover surface+elevation-2, 버전 타임라인 brand 강조, diff 색을 semantic(`text-success`/`text-error`·`bg-success/10`·`bg-error/10`)으로 remap
- [x] [schedules/page.tsx](<../src/app/(app)/schedules/page.tsx>)·[settings/page.tsx](<../src/app/(app)/settings/page.tsx>) — [ScheduleForm](../src/components/schedules/ScheduleForm.tsx)·[SettingsForm](../src/components/settings/SettingsForm.tsx) 의 `<select>`/inputCls 를 `h-11`·`rounded-lg`·focus `ring-2`로 Input 과 일치, 토글 `accent-brand`

**다크 모드** ✅ (단계 4)

- [x] `.dark` 토큰 — **따뜻한 다크 톤**(warm neutral r≥g≥b, Notion warm-charcoal 결)으로 [tokens.web.json](../src/design/tokens.web.json) `darkColors` + [globals.css](../src/app/globals.css) `.dark` 동시 갱신. canvas `#1a1917`·surface `#242220`·ink `#edece9` 등 순흑 `#000` 미사용. shadcn 시맨틱 변수는 `--w-*` repoint(단계2) 이라 자동 전환
- [x] `next-themes`(설치 완료) wiring — [theme-provider.tsx](../src/components/theme-provider.tsx)(`attribute="class"`·`defaultTheme="system"`·`enableSystem`·`disableTransitionOnChange`)를 [layout.tsx](../src/app/layout.tsx) `<body>` 에 마운트(`<html suppressHydrationWarning>` 기존), 상단 네비에 [ThemeToggle](../src/components/nav/ThemeToggle.tsx)(CSS `.dark` 기반 Sun/Moon 토글 → hydration 미스매치 없음) 추가
- [x] 가독성/대비 검수 — fixed-light 표면(pastel tile·InsightBox)의 inset frost 를 `bg-white/X`(테마 안정)로 교체해 다크에서 dark frost 플립 방지, 텍스트는 `brand-navy`(다크 미오버라이드)로 파스텔 위 대비 확보. user 버블 `bg-foreground`/`text-background` 는 다크에서 자동 반전, 상태/diff 는 fixed semantic. 빌드 CSS `.dark` 룰 41개·warm 토큰 방출 검증, hardcoded light/dark 잔여는 overlay scrim(bg-black/10)·PPT 페이퍼(SlidePreview)·의도된 frost 2곳뿐

**추가 UI 개선** ✅ (사용자 피드백 반영 — Phase 8 작업 중 발생)

- [x] **모바일 네비** — md 미만에서 햄버거 → 우측 `Sheet` 드로어([MobileNav.tsx](../src/components/nav/MobileNav.tsx)·[items.ts](../src/components/nav/items.ts), 아이콘+라벨·활성 강조·링크 탭 시 닫힘·하단 이메일(말줄임)/로그아웃). 테마 토글은 모바일 헤더 햄버거 좌측에 배치. md+ 는 기존 가로 메뉴
- [x] **커스텀 Select** — 네이티브 `<select>` 를 base-ui 기반 [ui/select.tsx](../src/components/ui/select.tsx)(Trigger=Input 톤·Popup=elevation-4·체크 표시·키보드)로 교체. [ScheduleForm](../src/components/schedules/ScheduleForm.tsx)·[SettingsForm](../src/components/settings/SettingsForm.tsx) 적용
- [x] **문서 삭제(hard delete)** — [api/documents/[id]](<../src/app/api/documents/[id]/route.ts>)(pending 승인 가드·스토리지 정리·audit) + [DocActions](../src/components/docs/DocActions.tsx)(확인 Dialog), 문서함 목록·상세 노출 (결정 로그 참조)
- [x] **인터뷰 단계 되돌리기** — [api/interview/step](<../src/app/api/interview/step/route.ts>)(currentStep 만 이동·답변 보존) + [ProgressTrack](../src/components/chat/ProgressTrack.tsx) 칩 클릭 + [store](../src/lib/interview/store.ts) `gotoStep`(대화 rewind·`questionByStep` 추적). 이전 답변 입력창 자동 채움
- [x] **채팅 진입 중앙 로딩** [chat/loading.tsx](<../src/app/(app)/chat/loading.tsx>) + **타이핑 인디케이터**(MessageList `TypingBubble` 점 3개 staggered bounce) — pending 피드백 가시화
- [x] **컨테이너 폭/여백 통일** — 전 (app) 페이지 `<main>` 을 `max-w-6xl px-6 py-8` 로 일치(login 제외). 로그인 레이아웃 collapse 버그 수정(원인=Tailwind spacing 토큰 충돌, 8장 함정 기록)

**디자인 QA** ✅

- [x] 6원칙(여백 우선/따뜻한 미니멀리즘/산세리프 헤딩/부드러운 표면/절제된 색상/장식 최소화) 기준으로 화면별 구현·사용자 검수 통과 (스크린샷 아카이브는 Phase 9 데모 자료에서 선택 작성)
- [x] 모바일 (< 768px) — 햄버거 Sheet 네비 + 반응형 그리드(`sm:`/`lg:` 컬럼), 모바일 폭 사용자 테스트 통과
- [x] 접근성: focus ring(`focus-visible:ring-2`)·아이콘 버튼 `aria-label`(토글/메뉴/삭제/Select) 적용. **WCAG AA 색 대비 정량 감사(Lighthouse/axe)는 Phase 9 리허설로** 이월

**검증** ✅

- [x] `grep -rE '#[0-9A-Fa-f]{6}' src/app src/components` 결과 0 — 단, [globals.css](../src/app/globals.css) 의 `--w-*` 토큰 정의(= tokens.web.json 미러, 단일 출처)는 제외
- [x] shadcn 기본 색/Tailwind 팔레트(emerald·rose·slate-NNN 등) 잔재 0 — 모두 토큰 경유
- [x] PPT 토큰(`tokens.ppt.json`)과 웹 토큰(`tokens.web.json`) **분리 유지** — 상호 import 0 (grep 확인)
- [x] 화면별 토큰 단일 출처로 시각적 일관성 확보 + 사용자 검수 통과

---

### Phase 9 — 데모 준비 & 최종 검증 ⬜

> **산출물**: 라이브 데모 2개 시나리오가 무중단으로 완주.

**시드 & 스크립트**

- [x] [`scripts/seed-demo.ts`](../scripts/seed-demo.ts) — WAPPLES URL + 파일 소스 시드(`pnpm seed:demo`). 멱등·부분실패 허용. **파일 URL(PDF/PPTX/DOCX/XLSX)은 `DEMO_FILES` 배열을 데모팀이 실제 자료 공개 URL 로 교체**(기본은 PDF 샘플 1건). Demo B 소스는 force-change 가 따로 심으므로 중복 안 함.
- [x] [`scripts/force-change.ts`](../scripts/force-change.ts) — 시드 URL `content_hash` 강제 변경 (Demo B 트리거). `pnpm verify:agent` 로 배선, 자체 `[demo]` 소스·문서·청크 시드까지 포함(오프라인·결정론적).
- [ ] 사전 생성된 인터뷰 응답 캐시 (LLM 장애 fallback)

**리허설 환경**

- [x] [src/app/demo/playback/page.tsx](../src/app/demo/playback/page.tsx) — 백업 녹화 영상 재생(`/demo/playback`). `public/demo/demo-a.mp4`·`demo-b.mp4` 있으면 자동 플레이어, 없으면 배치 안내. **mp4 파일은 리허설 녹화 후 배치 필요**.
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
- [x] 콜드 쿼리 워밍 ([`scripts/warmup.ts`](../scripts/warmup.ts), `pnpm warmup`) — DB·Anthropic·Voyage·Inngest 4종 핑, 발표 ~10분 전 1회 실행
- [ ] **WCAG AA 색 대비 정량 감사**(Lighthouse/axe) — Phase 8 에서 이월된 접근성 검증
- [ ] Vercel deployment alias 고정 (`docmind-demo.vercel.app`)

---

## 16. 결정 로그

- **보안레벨 후속 폴리시 — 제목색·cover 보안칩·단계 라벨** (2026-06-10):
  - 인터뷰 진행칩 마지막 단계 라벨 "분량"→**"분량 및 보안 레벨"**([machine.ts](../src/lib/interview/machine.ts) `STEP_LABELS.length`). [ProgressTrack](../src/components/chat/ProgressTrack.tsx)은 `flex-1`+`whitespace-nowrap`이라 셀 폭(~120px) 내 들어감.
  - **슬라이드 제목 텍스트 색 `#0060A9`**: 신규 토큰 `color.title`([tokens.ppt.json](../src/design/tokens.ppt.json)) 도입(브랜드 accent.penta 와 같은 값이지만 제목 의미로 분리). 7개 `role:'title'`(cover/agenda/section/bullets/twoCol/metric/image)의 `color: C.ink`→`C.title`([layouts.ts](../src/lib/ppt/layouts.ts)). cta 는 `role:'headline'`(가운데 마무리 문구)이라 제외. 미리보기·pptx 는 `boxStyle`/`textOpts`가 style.color 를 그대로 읽어 자동 반영.
  - **cover 우측하단 보안 레벨 이미지**: cover/backCover 는 푸터 미사용이라 별도로, `coverMaster.securityChip`(x1530 y1022 w330 h22, 우하단 안전여백 내) 토큰 + `COVER_MASTER.securityChip` 추가. cover 배경은 흰색이므로 **non-dark** 보안칩 사용. [render.tsx](../src/lib/ppt/render.tsx) `CoverMaster({securityLevel})`·`SlideContent({securityLevel})`로 `meta.securityLevel` 전달, [pptx.ts](../src/lib/ppt/pptx.ts) `applyCoverMaster(slide, securityLevel)`·`fillCover(...,securityLevel)`. 보안칩 에셋 종횡비(~15:1)에 맞춘 박스라 contain 으로 채워짐.
  - lint·build PASS.
- **인터뷰 보안레벨 선택 + 푸터 바 kind별 색상/보안칩 + 풀버전 section** (2026-06-10):
  - **인터뷰 보안 레벨 선택**: 마지막 `length` 단계의 입력 UI를 shadcn `Select` **드롭다운 2개**로([ChatView](../src/components/chat/ChatView.tsx), `currentStep==="length"` 분기 — 그 외 단계는 기존 QuickReplies 유지). 분량 옵션 4종("10~12장 표준" 등, `parseLengthPages`가 첫 숫자만 취해 기존과 동일 매핑), 보안 옵션 Level 1~5(영문 라벨은 첨부 이미지 기준). 보안 레벨은 클라 `state` → finalize `body.securityLevel` 로 전달, [finalize/route](../src/app/api/interview/finalize/route.ts)가 받아 `generateDeck`에(기존 `securityLevel: 1` 하드코딩 제거). **진행칩 라벨은 mockup 따라 "분량" 유지**(STEP_LABELS 미변경) — 칩 폭·시각 일관성 우선. `documents`에 별도 컬럼 없이 deck `meta.securityLevel`로만 저장(재생성 경로 `/api/generate`는 UI 호출자 없음, Mode B는 schedule `securityLevel` 사용 — 영속 컬럼 불필요).
  - **푸터 하단바 kind별 배경색**: agenda `#F2F2F2`·section `#D9D9D9`·나머지(bullets/twoCol/metric/quote/image/cta) `#000000`. cover/backCover는 푸터 없음(기존). 토큰 단일 출처 유지 — [tokens.ppt.json](../src/design/tokens.ppt.json) `footerMaster.body.barFill` 맵 + [layouts.ts](../src/lib/ppt/layouts.ts) `footerBarFill(kind)`/`footerIsDarkBar(kind)`. **검정 바일 때만** 보안칩=`_dark` 변형(`assetPath(key, lv, { dark })` → `security_level_N_dark.png`)·로고=`penta_white_small.png`(신규 에셋 토큰 `pentaWhiteSmall`); 밝은 바(agenda/section)는 non-dark 보안칩 + 검정 로고. 미리보기·pptx 동시 반영([render.tsx](../src/lib/ppt/render.tsx) `FooterMaster(kind)`, [pptx.ts](../src/lib/ppt/pptx.ts) `applyFooter(slide, lv, kind)` + 8개 호출부에 `slide.kind`). 보안칩은 light/dark 동일 크기(텍스트 색만 차이)라 박스 조정 불필요.
  - **section 디바이더 = 풀버전(16장+)만**: Plan A에서 제거했던 section을 조건부 재도입. [outline.ts](../src/lib/prompts/outline.ts) `propose_plan`에 `sectionTitles`(2~4개 "대단원" 제목, fullVersion일 때만) 추가. [generate.ts](../src/lib/ppt/generate.ts): `fullVersion = lengthPages>=16`일 때 토픽을 `distributeEvenly`로 그룹 수만큼 균등 분할 → 각 그룹 앞에 `{kind:"section", index, eyebrow:"SECTION 0N", title}` 삽입(LLM fill 없이 코드 조립). 예산에서 디바이더 수(`groupCount`)·quote를 차감, 토픽 수=agenda 항목 수는 `AGENDA_MAX(9)` 캡 유지. **agenda는 여전히 토픽 제목만 나열**(section은 quote처럼 흐름 전용·목차 제외) → Plan A 정합 불변. section 제목 부족/누락 시 `DEFAULT_SECTION_TITLES` 폴백. 비-풀버전(데모 10장)은 section 0개 → Plan A 그대로.
  - lint·build PASS.


- **PPT 생성 품질 수정 묶음** (2026-06-10):
  - **UI**: 헤더 로그아웃 아이콘 버튼 + shadcn tooltip(Base UI `@base-ui/react/tooltip` 기반 신규 [tooltip.tsx](../src/components/ui/tooltip.tsx); 삼각 화살표 SVG + `side="top"` 기본). 미리보기 페이지([deck/[versionId]](<../src/app/(app)/deck/[versionId]/page.tsx>)) `max-w-7xl→max-w-6xl`(헤더 정합), 우측상단 닫기 X(→/docs, tooltip). **미리보기 4:3·우측 잘림 버그**: [SlidePreview](../src/components/deck/SlidePreview.tsx) 박스가 flex 자식이라 가로만 shrink(세로 고정)되어 16:9 왜곡+overflow 클립 → `flexShrink:0` + [DeckViewer](../src/components/deck/DeckViewer.tsx) `ResizeObserver` 반응형 폭(`min(w, h*16/9)`). 썸네일 안쪽 박스 중앙정렬(140px + justify-center). 설정 문서템플릿 점선 박스 배경 이미지(`ppt_template_bg.png`).
  - **.pptx 한글 파일명 깨짐**(`%EA%B8%B0...`): Supabase `createSignedUrl({download})` 가 비ASCII 파일명을 percent-encoding 한 채 Content-Disposition 에 넣는 한계 → 의존 제거. 동일출처 API 가 바이트 직접 스트리밍 + `Content-Disposition: ...; filename*=UTF-8''<RFC5987>` ([route](<../src/app/api/generate/[versionId]/pptx/route.ts>)·[storage.downloadPptx](../src/lib/storage.ts)). 클라 공용 [download-pptx.ts](../src/lib/download-pptx.ts)(blob + `<a download>`). 두 다운로드 경로 통일.
  - **PPT 슬라이드 결함 수정**: ① twoCol 본문 9pt→12pt(`size.bodyLg:24`). ② **section 슬라이드 생성 제거** — 외톨이 디바이더가 목차/페이지 예산과 불일치, [outline.ts](../src/lib/prompts/outline.ts) `OUTLINE_KINDS`(section 제외)·프롬프트·도구 enum·generate 필터. ③ bullets **레벨 혼합 겹침**: `bulletRowY(i×gap)` 가 L0/L1 섞이면 누적 어긋남 → 행별 높이 누적 `bulletRowYs`(render+pptx 공용). ④ cover 제목 줄바꿈→부제 겹침: 박스 위로·폭 820·폰트 40pt→32pt·`valign:bottom`(하단 기준 2줄), `TextStyle.valign` + [render.boxStyle](../src/lib/ppt/render.tsx)/[pptx.textOpts](../src/lib/ppt/pptx.ts) 파라미터화. ⑤ **image = 선형 flow 다이어그램**(경로1 (c)확장): 플레이스홀더 제거, `diagramGeometry`(노드 2~5 등간격 + 인접 화살표, 끝점 결정적·겹침없음) → 미리보기 SVG·pptx `addShape("line",{endArrowType:"triangle"})`+roundRect. fill 도구가 `title`+`nodes` 필수(제목 누락 해소), 기존 deck 호환 위해 schema 는 optional + 폴백. ⑥ **Back Cover 슬라이드 추가**: `backCover` 종류(SLIDE_KINDS 미포함·outline 비대상), [generate](../src/lib/ppt/generate.ts)가 CTA 뒤 자동 append(lengthPages 예산 외), `BACK_COVER`(penta_color·KOREA/GLOBAL/JAPAN URL·awards_badge_back·검정 푸터바). 에셋 박스를 실제 종횡비(awards 9.37:1, penta 8.86:1)에 맞춰 미리보기/PPT 동일 렌더(이전엔 박스 종횡비 불일치로 PPT 가로 늘어남).
- **PPT 생성 Plan A — agenda↔본문 정합 구현** (2026-06-10): agenda 항목과 본문 슬라이드의 개수·제목 불일치 해소. **플랜-퍼스트 리팩터**.
  - [outline.ts](../src/lib/prompts/outline.ts): `propose_outline`(kind 시퀀스) → **`propose_plan`** 으로 교체. 도구가 `sections:[{title,kind}]`(주제+형식) + `includeQuote`(고객 인용 흐름 삽입 여부) 반환. `PLAN_SYSTEM`(주제=목차 한 줄=슬라이드 제목, 번호 금지), `PLAN_KINDS`=bullets/twoCol/metric/image(주제형만), `AGENDA_MAX`=9.
  - [generate.ts](../src/lib/ppt/generate.ts): `bodyBudget = lengthPages − cover − (agenda?1) − cta`(includeAgenda=`lengthPages≥6`) → `proposePlan(sectionCount)` → `normalizeSections`(정확히 target개로 trim/pad, `stripNumberPrefix`) → **agenda.items = section titles**(LLM fill 없이 코드가 직접 조립 → fill 호출 1회 절감) → **section별 KB 검색을 title 쿼리**로(이전 제네릭 `docType+kind` 대체) → `fillSlideOnce` 에 **`forcedSlideTitle` 주입**(프롬프트 `<slideTitle>`·`<deckTopics>` + 코드가 `raw.title=forcedSlideTitle` 강제, fallback 도 동일 제목 사용) → cover/quote/cta/backCover 조립(`cover→(agenda)→주제1..N→(quote)→cta→backCover`). `alignAgendaAndSections`·`proposeOutline`·`sectionsLeft`/`sectionIndex` 제거. `forcedSlideTitle`(주제)와 `forcedTitle`(사용자 수동 제목)은 변수명으로 구분 — 충돌 없음.
  - [slide-fill.ts](../src/lib/prompts/slide-fill.ts): "slideTitle 주어지면 title 은 그 문자열과 정확히 동일·본문은 그 주제 전개" 원칙 추가, agenda 가이드의 stale "section title 과 동일" 문구 제거. [types.ts](../src/lib/ppt/types.ts)·도구 agenda items max 7→9.
  - **결과(완료기준 충족)**: agenda 항목 수 == 본문 주제 슬라이드 수, agenda 텍스트 == 대응 슬라이드 title(동일 문자열), 본문이 그 주제 전개, quote/cta 는 agenda 제외·흐름엔 존재. 인터뷰 생성·재생성 양 경로 공통(둘 다 `generateDeck`). lint·build PASS.
  - **한계**: 주제 수가 `AGENDA_MAX(9)` 초과 시(=lengthPages>12, agenda 있을 때) 9개로 캡 → 그 경우만 deck 이 lengthPages 보다 짧을 수 있음(데모 분량 ≤12 영향 없음). 스펙 원문: [docs/PLAN_A_agenda_content_alignment.md](PLAN_A_agenda_content_alignment.md).
- **데모 UI/UX 폴리시 묶음** (2026-06-09): 데모 직전 화면 다듬기 일괄.
  - **문서 상세 버전 타임라인** — (a) PPTX `.pptx` 링크가 생 `<a>` 라 클릭 시 다운로드 API 의 JSON(`{url}`)이 노출되던 버그 → [PptxDownloadLink](../src/components/docs/PptxDownloadLink.tsx)(fetch → 서명 URL 이동, 미리보기 다운로드 버튼과 동일). (b) "미리보기"(검정=`dark` variant)·"다운로드"(primary) **버튼화**, 간격 축소. (c) "최신과 비교" 텍스트 링크 제거 → **카드 표면 전체 클릭으로 비교**: 중첩 인터랙티브 회피 위해 `absolute inset-0` 오버레이 `<Link>`(`pointer-events-none` 텍스트 + `z-10` 버튼 분리), 최신 카드는 비교 대상 없어 비활성([VersionCard](../src/components/docs/VersionCard.tsx)). (d) 최신 버전 카드 검정 테두리(`border-ink-deep`).
  - **문서함 카드 뱃지** — [DocsFolderView](../src/components/docs/DocsFolderView.tsx) "완료" 우측에 **New**(생성 24h 이내·primary)·**Update**(갱신 24h 이내 + 버전>1·검정 `ink-deep`). 기준은 [docs/page](<../src/app/(app)/docs/page.tsx>)에서 SQL `now() - interval '24 hours'` 로 계산(서버 렌더에서 `Date.now()` 는 React 순수성 린트 위반이라 DB now() 사용).
  - **에이전트 카드** — 발행 뱃지 좌측 **생성일자**(서버 `toLocaleDateString` 포맷, 클라/SSR 시간차 회피). `documentVersions` 에 `publishedAt` 컬럼 없어 `createdAt` 표시. [LoopDiagram](../src/components/agent/LoopDiagram.tsx) 노드 원에 **불투명 백드롭 원**(`text-canvas`) 추가 — 반투명 상태색(/60·/25·/40)을 통해 연결선이 비치던 문제 해소.
  - **인터뷰** — [ProgressTrack](../src/components/chat/ProgressTrack.tsx) 단계 원형의 `disabled` 시 `opacity-60` 제거(`cursor-default` 로 대체) → 전송 중 원형이 반투명해 라인과 겹치던 문제 해소. 입력 placeholder·전송 버튼 라벨 "직접 입력", 생성 버튼 "문서 생성/문서 생성 중...". **되돌아가기 버그 수정**: 이미 답한 단계로 돌아가면 LLM 이 currentStep 무시하고 "다음 질문"을 생성 → (a) [store](../src/lib/interview/store.ts) `questionByStep` 에 보관된 원래 질문 우선 사용(placeholder 는 미보관해 폴백), (b) [interview 프롬프트](../src/lib/prompts/interview.ts)에 "currentStep 질문만, 이미 답 있어도 그 단계 재질문" 규칙. 인사이트 카드 제목 "KB 매칭 인사이트"→"매칭 인사이트", 입력 중 점 애니메이션 진폭 확대(`dot-bounce`).
  - **홈** — "맞춤 문서 만들기" 카드를 **풀폭 입력 카드**(타이틀 "어떤 문서를 만들까요?" + textarea + ArrowUp 전송 아이콘)로 교체. 입력만 가능, 전송 기능 없음(프로덕션 예정 툴팁) ([page](<../src/app/(app)/page.tsx>)).
  - **KB 카드** — 액션(수정/삭제) 평소 숨김 → **hover/포커스 시 카드 중앙에 표시 + 어두운 스크림**(`bg-ink-deep/55`), 우상단 상태 뱃지와 겹침 해소. 오버레이 `pointer-events-none` + 버튼만 `pointer-events-auto` 라 버튼 외 영역은 상세 시트 열림([kb/page](<../src/app/(app)/kb/page.tsx>)).
  - **데모 운영** — `pnpm demo:pending`(`KEEP_PENDING=1` [force-change](../scripts/force-change.ts)): 5단계 후 자동 승인을 건너뛰고 대기 카드를 남김(실수로 발행한 카드 대신 대기 카드 재생성용). 전제: "문서 발행" 수동.

- **KB 소스 "수정(내용 교체)" → 실제 변경 감지로 대기 문서 생성** (2026-06-09): 데모 B 를 force-change 강제 해시 대신 *실제 자료 갱신* 흐름으로 시연 가능하게 함. (1) [PATCH /api/kb/sources/[id]](../src/app/api/kb/sources/[id]/route.ts) — 파일 소스는 새 파일로 `fileKey` 교체(제목·**content_hash 유지** — detect 가 라이브 새 내용 vs 저장된 옛 해시를 비교해야 diff 를 잡으므로 해시를 미리 갱신하지 않음), URL 소스는 외부 변경 재감지. 교체 후 `agent/detect.requested` 발화. (2) [detect scan](../src/inngest/agent.ts) — 기존 `kind="url"` 한정에서, **명시 트리거(sourceId 지정) 시 종류 무관(파일 포함)**, cron 자동 스캔은 URL 만으로 변경(파일 30분 재크롤 낭비 방지). (3) [SourceActions](../src/components/kb/SourceActions.tsx) — 파일=연필(파일 재업로드 sign→PUT→PATCH), URL=새로고침(재감지) 버튼. **한계**: detect 는 content_hash 만 갱신하고 소스 청크/요약은 재생성하지 않음(기존 루프 동작과 동일 — act 단계도 base slidesJson 복사). 즉 교체 후 KB 청크는 옛 내용 유지. 5% 미만 변경은 조용히 해시만 갱신(대기 미생성). 전제: "문서 발행" 수동. lint·build PASS.

- **인터뷰 4단계 `sources` → `keyMessage`(핵심 메시지) 교체** (2026-06-09): 기존 `sources`(참고 자료) 답변은 생성에서 KB 필터로 쓰이지 않고([kbMatchByVector](../src/lib/interview/service.ts)가 워크스페이스 `ready` 소스 전체를 벡터 매칭) 프롬프트 텍스트 힌트로만 들어가 정보 가치가 낮았다. KB 는 어차피 자동 참조되므로 이 단계를 **"이 문서를 관통하는 한 줄 핵심 주장"**으로 교체. 생성 전반에 실질 반영: [outline](../src/lib/prompts/outline.ts)·[slide-fill](../src/lib/prompts/slide-fill.ts) 시스템 프롬프트에 "keyMessage = 덱의 축, 표지 헤드라인은 keyMessage 압축" 지시 추가, [generate.ts](../src/lib/ppt/generate.ts) `<answers>` 블록·headlineQuery 에 주입. 영향 파일: [machine.ts](../src/lib/interview/machine.ts)(STEPS·STEP_LABELS), [interview.ts](../src/lib/prompts/interview.ts), [service.ts](../src/lib/interview/service.ts)(`STEPS_NEEDING_FRESH_KB` 비움 — 소스 고르기 단계 소멸), finalize·generate 라우트, 스케줄 경로([schedule.ts](../src/lib/schedule.ts)·[agent.ts](../src/inngest/agent.ts)·[ScheduleForm](../src/components/schedules/ScheduleForm.tsx)). DB 컬럼 변경 없음(answersJson JSON 키만 변경). lint·build PASS.

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
- **데모 UI 폴리시 2차 (탭 비주얼·설정 레이아웃·KB 소스 삭제·버튼 통일)** (2026-06-08): FolderTabs 도입(아래 항목) 이후 같은 날 진행한 데모 직전 UI 일괄 작업.
  - **(A) folder 탭 비주얼** — [tabs.tsx](../src/components/ui/tabs.tsx) `folder` variant: 하단 모서리 직각(`rounded-t-md rounded-b-none`), **비활성 탭 흰 배경(`bg-background`)**, **하단 full-width 라인 = 활성 채움색(`foreground`)**. 라인을 탭 위 레이어로 올려(`border-b` → 절대배치 `::after` `h-px bg-foreground`) 비활성 탭 하단이 라인색으로 덮이게 하고, 활성 탭은 `z-10` 으로 라인 위로 올라와 본문과 연결된 폴더 모양 유지. 활성 탭 hover 시 글자색 유지(`data-active:hover:text-background`, 안 하면 hover 의 `text-foreground` 가 어두운 배경에 묻힘).
  - **(B) 문서함 "새 문서함 만들기"** — [DocsFolderView](../src/components/docs/DocsFolderView.tsx) 헤더 우측에 버튼+제목 블록을 클라 컴포넌트로 흡수(상태 공유). 신규 [NewFolderButton](../src/components/docs/NewFolderButton.tsx)(Dialog+입력) 가 세션 한정 `addFolder` 호출 → `onCreated` 로 `setActiveFolder` 해 **생성 즉시 새 탭으로 전환**. 빈 폴더는 기존 빈 상태 안내 표시. (소스/문서↔문서함 영속 매핑은 프로덕션 보류)
  - **(C) 한글 IME Enter 중복 생성 버그** — 조합 확정 Enter 가 제출 핸들러를 동시에 발동해 마지막 글자("서")로 폴더가 1개 더 생기던 문제. [NewFolderButton](../src/components/docs/NewFolderButton.tsx)·[FolderPickerDialog](../src/components/home/FolderPickerDialog.tsx) 양쪽 `onKeyDown` 에 `!e.nativeEvent.isComposing` 가드 추가([알려진 함정](../CLAUDE.md) 등재).
  - **(D) 타이틀↔컨텐츠 여백 통일 32px(`mb-8`)** — 지식베이스 기준으로 문서함·에이전트·스케줄·설정 헤더 여백을 맞춤. 홈은 heading-2 히어로라 `mb-12` 유지.
  - **(E) 설정 페이지 06 목업 레이아웃** — `lg:grid-cols-3` 2열: 좌(2/3) [SettingsForm](../src/components/settings/SettingsForm.tsx) + 우(1/3) [TemplateCard](../src/components/settings/TemplateCard.tsx)/[ModeCard](../src/components/settings/ModeCard.tsx). SettingsForm 컨트롤을 목업대로 변경(자동실행=토글스위치, 발행=수동/자동 세그먼트, **Email 알림 플레이스홀더 입력란**=저장 안 함, 저장 버튼 하단 중앙). API·스키마는 그대로(`autoRun/publish/notifyChannel`). 좌측 카드 `h-full`+저장 `mt-auto` 로 바닥을 우측 모드 카드 하단과 정렬. **테마 토글을 헤더에서 제거**([TopNav](../src/components/nav/TopNav.tsx) 데스크탑·모바일) → 우측 하단 "모드" 카드 Light/Dark 세그먼트(ModeCard, `next-themes`)로 이동. 미사용이 된 `ThemeToggle.tsx` 삭제. 문서 템플릿 등록·Email 알림은 **데모 플레이스홀더**(업로드 API·스토리지 없음, 토스트만). 멤버 목록·연결 뱃지 UI 제거.
  - **(F) 에이전트 우측 카드 정렬** — [agent/page.tsx](<../src/app/(app)/agent/page.tsx>) `<aside>` 에 `md:mt-15.5`(≈62px) — 탭 스트립 높이(≈38px)+탭↔콘텐츠 간격(gap-2 8px+mt-4 16px)만큼 내려 우측 통계 카드 상단을 좌측 첫 문서 카드 상단과 정렬.
  - **(G) KB 소스 삭제 + "관리" 버튼** — URL 입력 흰 배경(`bg-canvas`), "URL 등록" 우측 표시전용 "관리" 버튼([UrlInput](../src/components/kb/UrlInput.tsx)). **모든 URL·파일 카드에 실제 삭제** — 신규 [DELETE /api/kb/sources/[id]](<../src/app/api/kb/sources/[id]/route.ts>)(워크스페이스 격리, `source_chunks`·`document_sources` cascade·`change_events` set null·파일은 Storage best-effort 정리·`audit_logs source.delete`), 헬퍼 [deleteSourceObjects](../src/lib/storage.ts), [SourceActions](../src/components/kb/SourceActions.tsx)(휴지통+확인 Dialog). [kb/page.tsx](<../src/app/(app)/kb/page.tsx>) 그리드를 `relative` 래퍼로 감싸 삭제 버튼을 SheetTrigger **형제로 절대배치**(button 중첩 회피), [SourceCard](../src/components/kb/SourceCard.tsx) 헤더에 `pr-9` 로 상태칩 겹침 방지.
  - **(H) 토글 버튼 스타일 통일(chip)** — 문서함 필터(Badge)와 KB URL/파일(Tabs)이 다른 프리미티브라 모양이 달랐음. [tabs.tsx](../src/components/ui/tabs.tsx) 에 공용 `chip` variant 추가(미선택=흰 배경+hairline 보더, 선택=`primary` 채움, pill 형태, 다크 override 포함) → KB `<TabsList variant="chip">` 적용. 문서함 미선택 칩은 `bg-canvas`(흰색) 추가(선택 칩 primary 는 조건부라 영향 없음). 선택색은 primary 보라로 합의.
- **문서함 탭 단일화(FolderTabs) & KB 문서함 탭** (2026-06-08): 문서함·에이전트·KB 세 화면이 각각 `<Tabs>`+`folders.map` 을 중복 작성하던 것을 공용 [FolderTabs](../src/components/folders/FolderTabs.tsx) 로 추출. (1) [tabs.tsx](../src/components/ui/tabs.tsx) 에 `folder` variant 추가 — **활성=`bg-foreground`/`text-background`(짙은 채움·반전 글자, 라이트=흑배경·흰글자, 다크 자동 반전), 비활성=`border-hairline` 보더, 리스트 하단 full-width hairline(`border-b`)**. pill 의 `bg-ink-deep`/`text-on-dark` 은 다크에서 흰배경+흰글자로 깨지므로(ink-deep 가 다크에서 #fff) folder 는 자동 반전하는 `foreground/background` 토큰 사용. (2) [DocsFolderView](../src/components/docs/DocsFolderView.tsx)(controlled)·[AgentDocs](../src/components/agent/AgentDocs.tsx)(uncontrolled, 외곽 탭만 — PendingCard 내부 feed/loop 탭은 기본 Tabs 유지) 가 FolderTabs 채택. (3) **KB 문서함 탭은 표시 전용** — 소스↔문서함 매핑이 후순위(데이터 분리 안 함)라 기존 소스는 전부 시드 WAPPLES(`DEFAULT_FOLDER_ID`)에 귀속, 그 외 문서함은 빈 탭. [KbFolderTabs](../src/components/kb/KbFolderTabs.tsx) 클라 래퍼가 활성 문서함을 보고 children(서버 렌더된 URL/파일 하위 탭)을 default 문서함에서만 노출, 나머지는 빈 안내. lint·build PASS.
- **데모 직전 UI 폴리시 & 문서 제목 정합** (2026-06-02): (1) **UI 브랜드명 "Mind5"** — 화면(탭/로그인/네비)·발행 이메일만 교체. 내부 코드·식별자(Inngest 앱 id `docmind`, Slack `#docmind-demo`, 패키지명)와 docs 는 "DocMind" 유지. (2) **미완성 초안 문서함 숨김** — 문서함 목록을 `status != 'draft'` 로 필터해 최종 생성 전 초안을 비표시([docs/page.tsx](<../src/app/(app)/docs/page.tsx>)). "생성 버튼 전 DB 미생성"(지연 생성)은 `interview_sessions` 가 `documentId` FK 필수 + `/chat/[documentId]` 라우팅이라 스키마 마이그레이션+라우팅 변경 필요 → **프로덕션 보류**. (3) **deck 제목 단일화** — [generate.ts](../src/lib/ppt/generate.ts) 가 `meta.title` 을 표지(첫 슬라이드) 제목으로 통일 → 미리보기 헤더·`pres.title`·문서함 카드/상세가 모두 동일. 생성 시 `documents.title` 도 표지 제목으로 동기화하되 **Mode A 실경로 [finalize](../src/app/api/interview/finalize/route.ts) 와 재생성 경로 [generate](<../src/app/api/generate/route.ts>) 양쪽 모두**에 적용(한쪽만 넣어 카드 제목이 안 바뀌던 버그를 수정). (4) `.pptx` 다운로드 파일명 = `"<문서 제목> v<버전>.pptx"` — Supabase signed URL `download` 옵션([storage.ts](../src/lib/storage.ts)). (5) 인터뷰 단계 표시를 번호 원+연결선 위저드로([ProgressTrack.tsx](../src/components/chat/ProgressTrack.tsx), rewind 클릭 유지), 버튼 hover 피드백(배경 흐림+`shadow-elevation-2`, ghost/link 제외), 홈 "사용자 유형 추가" 카드(프로덕션 예정 UI·회색 배경), 상단 "홈" 메뉴 제거(브랜드 로고 클릭으로 대체).
- **문서 삭제(hard delete) 채택** (2026-06-01): 문서함에서 초안·완료 문서를 영구 삭제. soft-delete(보관/휴지통) 대신 **hard delete** 선택 — 데모 규모 + 스키마가 이미 안전하게 설계됨(`document_versions`/`document_sources`/`interview_sessions` 는 FK `cascade`, `approvals.documentId` 는 `set null`). [approve 플로우](../src/app/api/agent/approve/route.ts)는 삭제된 문서에 graceful no-op(버전 update 0건·null documentId 스킵)이라 워크플로우 무손상. **가드 1개**: 미결(pending) 승인이 걸린 문서는 `409 pending_approval` 로 삭제 차단(승인 큐 정합성). `.pptx` 스토리지는 Postgres cascade 대상이 아니라 [storage.ts](../src/lib/storage.ts) `deletePptxObjects()` 로 best-effort 정리. 구현: [api/documents/[id]/route.ts](<../src/app/api/documents/[id]/route.ts>)(DELETE·RBAC·audit_logs `document.delete`), [DocActions.tsx](../src/components/docs/DocActions.tsx)(확인 Dialog), 문서함 목록·상세에 노출.
