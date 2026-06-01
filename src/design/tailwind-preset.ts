// 웹 디자인 토큰의 타입드 접근점. tokens.web.json 단일 출처를 import 한다.
//
// Tailwind v4 적응 노트: 이 프로젝트는 CSS-first(@theme in globals.css)라 Tailwind
// 유틸리티는 globals.css 에서 생성된다. 따라서 이 파일은 v3 식 preset 으로 "소비"되지
// 않고, (a) 컴포넌트/JS 에서 토큰 값을 직접 쓸 때(예: SVG fill, 차트), (b) 향후 v3 호환
// config 가 필요할 때를 위한 theme.extend 형태 export 로 쓴다.

import tokens from "./tokens.web.json";

export const webTokens = tokens;

export type WebColorToken = keyof typeof tokens.colors;
export type WebSpacingToken = keyof typeof tokens.spacing;
export type WebRadiusToken = keyof typeof tokens.radius;
export type WebTypographyToken = keyof typeof tokens.typography;

export function color(name: WebColorToken): string {
  return tokens.colors[name];
}

// Tailwind theme.extend 형태 (포터빌리티/참조용).
export const tailwindThemeExtend = {
  colors: { ...tokens.colors } as Record<string, string>,
  spacing: { ...tokens.spacing } as Record<string, string>,
  borderRadius: { ...tokens.radius } as Record<string, string>,
  fontFamily: {
    sans: tokens.fontFamily.sans.split(",").map((s) => s.trim()),
  },
  fontSize: Object.fromEntries(
    Object.entries(tokens.typography).map(([name, t]) => [
      name,
      [
        t.size,
        {
          lineHeight: t.lineHeight,
          fontWeight: String(t.weight),
          letterSpacing: t.letterSpacing,
        },
      ],
    ]),
  ) as Record<string, [string, { lineHeight: string; fontWeight: string; letterSpacing: string }]>,
  boxShadow: Object.fromEntries(
    Object.entries(tokens.elevation).map(([level, shadow]) => [
      `elevation-${level}`,
      shadow,
    ]),
  ) as Record<string, string>,
} as const;

export default tailwindThemeExtend;
