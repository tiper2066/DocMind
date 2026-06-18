// UI 열람 전용 데모 모드. 발표·데모 종료 후 비용/만료 서비스(Anthropic·Voyage·
// Inngest)의 연결을 끊고 기존 데이터로 화면만 둘러볼 때 켠다. 켜지면 인터뷰 질문은
// 정해진 값, 덱 생성은 고정 슬라이드, Inngest 발화는 no-op 으로 단락된다.
// 기본 false → 플래그가 없으면 기존(실서비스) 동작 그대로.
export const UI_ONLY = process.env.DEMO_UI_ONLY === "1";
