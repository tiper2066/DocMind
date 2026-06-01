# DocMind PPT 레이아웃 스펙

> 출처: 펜타시큐리티 코퍼레이트 PPT 템플릿 (Figma `s10NvmcaLP3ytq56jH9zyd`)
> 기반 슬라이드: `level_1_01_16x9` (표지) · `level_1_02~04_16x9` (본문 골격) · `end_16x9` (엔딩)
> 작성일: 2026-05-27 · 버전 1.0

이 문서는 [docs/IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) 5.4 의 **Slide IR 9종**(`cover/agenda/section/bullets/twoCol/metric/quote/image/cta`)이 1920×1080(16:9) 캔버스에서 어떤 좌표·색·타이포로 그려지는지를 정의한다. 웹 미리보기 `<Slide>` 컴포넌트와 `pptxgenjs` 다운로드가 **이 스펙을 단일 출처로 공유**한다.

토큰 JSON: [src/design/tokens.ppt.json](../src/design/tokens.ppt.json)
TS 레이아웃: [src/lib/ppt/layouts.ts](../src/lib/ppt/layouts.ts)

---

## 1. 캔버스 & 자산

### 1.1 캔버스

| 속성 | 값 |
|---|---|
| 사이즈 | 1920×1080 (16:9) |
| 배경 | `#FFFFFF` |
| 단위 | px (pptxgenjs 변환 시 EMU 또는 inch 계산) |

### 1.2 자산 ([src/design/assets/ppt/](../src/design/assets/ppt/))

| 파일 | 크기 | 사용 위치 |
|---|---|---|
| `penta_black_large.png` | 243×27 | 표지 좌상단 |
| `penta_black_small.png` | 210×14 | **모든 본문·엔딩 우하단 (마스터)** |
| `penta_color.png` | — | 엔딩 또는 강조용 |
| `earth_security_node.png` | 970×627 | 표지 우측 |
| `awards_badge_cover.png` | 406×80 | 표지 좌하단 |
| `awards_badge_back.png` | 1209×129 | 엔딩 전용 |
| `security_level_1~5.png` | 142×16 | **모든 본문 좌하단 (마스터)** — Deck 단위 1종 선택 |

---

## 2. 디자인 토큰 (요약)

전체 토큰 정의는 [src/design/tokens.ppt.json](../src/design/tokens.ppt.json) 참조.

### 2.1 색

| 토큰 | 값 | 용도 |
|---|---|---|
| `color.bg` | `#FFFFFF` | 캔버스 |
| `color.footer.body` | `#F2F2F2` | 본문 슬라이드 하단 36px 바 |
| `color.footer.end` | `#000000` | 엔딩 슬라이드 하단 36px 바 |
| `color.ink` | `#000000` | 헤드라인·1차 텍스트 |
| `color.text.secondary` | `#7F7F7F` | 라벨·캡션 |
| `color.text.tertiary` | `#999B9E` | Penta 로고 'SECURITY' 글자색 · URL 등 보조 메타 |
| `color.text.muted` | `#C9C9C9` | 카피라이트 |
| `color.rule` | `#E5E5E5` | 가는 분할선 |
| `color.accent.penta` | `#0060A9` | **유일한 컬러 액센트** (타이틀 라인, 키 수치) · Penta 로고 'penta' 글자색 |

### 2.2 타이포

```
family.heading = family.body = "Pretendard, 'Gotham', 'Malgun Gothic', sans-serif"
weight = { bold: 700, medium: 500, book: 400 }
```

| 토큰 | 사이즈 | tracking | 용도 |
|---|---|---|---|
| `size.display` | 80 | -2px | 표지 타이틀, 섹션 디바이더 |
| `size.h1` | 56 | -1px | agenda/cta 헤드라인 |
| `size.h2` | 44 | -1px | 본문 슬라이드 타이틀 |
| `size.h3` | 28 | -0.7px | agenda 항목, 부제 |
| `size.h4` | 22 | -0.5px | 1차 불릿 |
| `size.body` | 18 | -0.5px | 본문, 2차 불릿 |
| `size.small` | 14 | -0.7px | 캡션, 메타 |
| `size.micro` | 10.5 | 0 | 어워드 라벨 |
| `tracking.eyebrow` | — | +4px | eyebrow 라벨 (SECTION 01) |

### 2.3 여백

| 토큰 | 값 |
|---|---|
| `safe.x` | 120 (좌·우) |
| `safe.y.top` | 120 |
| `safe.y.bot` | 60 (푸터 36px 위로 24px 여유) |
| `footer.h` | 36 |
| `gap.col` | 80 |
| `gap.row` | 60 |

→ **콘텐츠 안전영역**: x=[120, 1800], y=[120, 1020], 즉 **1680×900**.

---

## 3. 공통 마스터

### 3.1 Body Footer Master (8종 본문 공통)

```
─────────────────────────────────────────────────────────  y=1044
│  [penta_black_small]                  [security_level_x] │
│   10/1054 · 142×16                    1700/1056 · 210×14 │
─────────────────────────────────────────────────────────  y=1080
   ▲ 36px bar · fill #F2F2F2
```

| 요소 | x | y | w | h | 자산/스타일 |
|---|---|---|---|---|---|
| Footer bar | 0 | 1044 | 1920 | 36 | fill `color.footer.body` |
| Penta wordmark (좌하단) | 10 | 1054 | 142 | 16 | `penta_black_small.png` (자연 비율 8.875 = 142/16) |
| Security level chip (우하단) | 1700 | 1056 | 210 | 14 | `security_level_{deck.securityLevel}.png` (자연 비율 15.0 = 210/14) |

> 2026-05-29 정정: 이전 문서는 security/wordmark 좌우 위치와 박스 크기가 모두 swap 되어 있었음. 실제 자산 비율 (`penta_black_small.png` 426×48 = 8.875, `security_level_1.png` 630×42 = 15.0) 과 일치하지 않아 stretch 발생. 위 표가 정정본 — `tokens.ppt.json` 도 같이 갱신.

### 3.2 Cover Master (표지 전용)

| 요소 | x | y | w | h | 자산 |
|---|---|---|---|---|---|
| Penta wordmark (large) | 61 | 57 | 243 | 27 | `penta_black_large.png` |
| Earth illustration | 952 | 455 | 970 | 627 | `earth_security_node.png` |
| Awards badges (4) | 61 | 978 | 406 | 80 | `awards_badge_cover.png` |

표지는 footer bar **미사용**.

---

## 4. 본문 9종 레이아웃

각 레이아웃은 안전영역(1680×900) 내부의 **콘텐츠 박스 좌표**만 정의한다. 모든 본문은 §3.1 푸터 마스터를 자동 상속.

### ① `cover` — 표지

| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Title | 120 | 480 | 800 | 120 | `size.display` Bold `tracking.display` |
| Subtitle | 120 | 620 | 800 | 60 | `size.h3` Book `color.text.secondary` |
| Author + Date | 120 | 920 | 800 | 30 | `size.small` Book `color.text.secondary` |

### ② `agenda` — 목차

| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Title ("목차") | 120 | 120 | 1680 | 80 | `size.h1` Bold |
| Accent rule | 120 | 220 | 60 | 2 | fill `color.accent.penta` |
| Item index (01, 02…) | 120 | 320+ | 80 | 40 | `size.h3` Book `color.text.secondary` |
| Item title | 220 | 320+ | 1580 | 40 | `size.h3` Medium `color.ink` |
| Item 행 간격 | — | — | — | 80 | 최대 7개 권장 |

### ③ `section` — 섹션 디바이더

| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Big index (워터마크) | 120 | 200 | 600 | 300 | font-size 240 `color.footer.body` Bold |
| Eyebrow ("SECTION 01") | 120 | 560 | 600 | 24 | `size.small` Bold `tracking.eyebrow` `color.text.secondary` |
| Section title | 120 | 600 | 1500 | 120 | `size.display` Bold `tracking.display` |

### ④ `bullets` — 불릿 본문 (가장 빈도 높음)

| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Title | 120 | 120 | 1680 | 60 | `size.h2` Bold `tracking.heading` |
| Accent rule | 120 | 200 | 60 | 2 | fill `color.accent.penta` |
| Bullet area | 120 | 260 | 1680 | 760 | — |
| L0 bullet marker (■) | 120 | per row | 12 | 12 | fill `color.ink` (y center align) |
| L0 bullet text | 152 | per row | 1528 | — | `size.h4` Medium, line-height 1.4 |
| L1 bullet marker (—) | 168 | per row | 16 | — | `size.body` `color.text.secondary` |
| L1 bullet text | 200 | per row | 1480 | — | `size.body` Book `#404040` |
| L0 행 간격 | — | — | — | 56 | 최대 5~6개 |
| L1 행 간격 | — | — | — | 36 | L0 사이에 1~2개 |

### ⑤ `twoCol` — 2단 비교

| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Title | 120 | 120 | 1680 | 60 | `size.h2` Bold |
| Accent rule | 120 | 200 | 60 | 2 | `color.accent.penta` |
| Left col label | 120 | 280 | 800 | 24 | `size.small` Bold `tracking.eyebrow` `color.text.secondary` |
| Left col body | 120 | 320 | 800 | 680 | `size.body` Book (bullets 가능) |
| Divider | 960 | 280 | 1 | 720 | fill `color.rule` |
| Right col label | 1000 | 280 | 800 | 24 | (동일) |
| Right col body | 1000 | 320 | 800 | 680 | (동일) |

### ⑥ `metric` — 지표 (3-up 또는 4-up)

**3-up (기본)**
| 카드 | x | y | w | h |
|---|---|---|---|---|
| Card 1 | 120 | 360 | 520 | 320 |
| Card 2 | 700 | 360 | 520 | 320 |
| Card 3 | 1280 | 360 | 520 | 320 |

**4-up (대안)** → 카드 폭 380, x=`120/520/920/1320`, gap 80.

각 카드 내부:
| 영역 | offset (x, y) | 스타일 |
|---|---|---|
| Label | (0, 0) | `size.small` Bold `tracking.eyebrow` `color.text.secondary` |
| Value | (0, 40) | font-size 88 Bold `color.accent.penta` |
| Delta | (0, 200) | `size.body` Medium · 양수 `#16A34A` / 음수 `#DC2626` |

### ⑦ `quote` — 인용

| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Big quote mark ("`"`") | 120 | 200 | 240 | 280 | font-size 280 `color.footer.body` |
| Quote text | 220 | 380 | 1480 | 320 | `size.h2` Regular line-height 1.4 |
| Attribution ("— 이름, 직책") | 220 | quote-end+60 | 1480 | 30 | `size.body` Book `color.text.secondary` |

### ⑧ `image` — 이미지

**8a. 제목 있음 (기본)**
| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Title | 120 | 120 | 1680 | 60 | `size.h2` Bold |
| Accent rule | 120 | 200 | 60 | 2 | `color.accent.penta` |
| Image | 220 | 280 | 1480 | 680 | `object-fit: contain` |
| Caption | 220 | 980 | 1480 | 30 | `size.small` Book `color.text.secondary` 가운데 |

**8b. 풀블리드 (제목 없음)**
| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Image | 0 | 0 | 1920 | 1044 | `object-fit: cover` (footer 위까지) |
| Caption (선택) | 60 | 990 | 1800 | 30 | `size.small` Book `#FFFFFF` + 반투명 BG |

### ⑨ `cta` — 마무리 액션

| 영역 | x | y | w | h | 스타일 |
|---|---|---|---|---|---|
| Headline | 120 | 380 | 1680 | 140 | font-size 64 Bold `tracking.heading` 가운데 |
| Accent rule | 920 | 540 | 80 | 3 | `color.accent.penta` 가운데 |
| Action text | 120 | 580 | 1680 | 40 | `size.h3` Book `color.text.secondary` 가운데 |
| Contact | 120 | 660 | 1680 | 32 | `size.h4` Medium `color.accent.penta` 가운데 |

---

## 5. 일관성 규칙

1. **타이틀 위치 고정**: `bullets/twoCol/metric/image(8a)` 4종은 모두 (120, 120). 슬라이드 간 점프 없음.
2. **타이틀 아래 가는 라인**: 60×2px `#0060A9` (Penta 로고 'penta' 글자색). **유일한 컬러 액센트**.
3. **컬러 위계**: `#000000` (1차) → `#404040` (2차) → `#7F7F7F` (라벨) → `#C9C9C9` (저작권).
4. **여백**: 좌우 120 / 상 120 / 하 60 (푸터 위). 풀블리드 이미지만 예외.
5. **모서리/그림자 없음**: sharp rectangle, no drop shadow. (피그마 원본 일치)
6. **이모지·아이콘 최소**: `■ — ▲ ▼` 정도만 허용. 코퍼레이트 톤 유지.
7. **폰트 fallback 체인**: `Pretendard → Gotham → 맑은 고딕 → sans-serif`. Gotham 미설치 환경(외부 PC) 대비.

---

## 6. Slide IR 매핑 ([src/lib/ppt/types.ts](../src/lib/ppt/types.ts))

[IMPLEMENTATION_PLAN.md:194-207](IMPLEMENTATION_PLAN.md#L194-L207) 의 IR과 1:1. 단 `Deck.meta` 에 다음 필드 **추가**:

```ts
type DeckMeta = {
  title: string;
  reader: string;
  cta: string;
  objection: string;
  lengthPages: number;
  securityLevel: 1 | 2 | 3 | 4 | 5;   // 추가 — 좌하단 칩 선택
  author?: string;                    // 추가 — cover 사용
  date?: string;                      // 추가 — cover 사용 (YYYY-MM-DD)
}
```

---

## 7. 구현 진입점 (Phase 4 가이드)

- 미리보기 React `<Slide kind="...">` 컴포넌트는 [src/lib/ppt/layouts.ts](../src/lib/ppt/layouts.ts) 의 `PPT_LAYOUTS[kind]` 박스 좌표를 그대로 absolute positioning.
- `pptxgenjs` 변환은 같은 `PPT_LAYOUTS[kind]` 를 `slide.addText/addImage/addShape` 인자로 변환. EMU 환산은 `px × (914400 / DPI)` 또는 inch 변환 헬퍼.
- 마스터 등록: `defineSlideMaster({ title: 'BODY', ...layout from §3.1 })` 한 번, 각 본문 슬라이드는 `masterName: 'BODY'`.

---

## 8. 변경 시 영향 범위

- `tokens.ppt.json` 만 바꿔도 웹 미리보기와 .pptx 양쪽에 자동 반영.
- 좌표를 바꾸려면 본 문서 §4 + `layouts.ts` 동시 수정. 둘이 단일 출처(SoT)이며 코드가 정답.
- 자산 파일명을 바꾸려면 `tokens.ppt.json.assets` 의 키만 갱신.
