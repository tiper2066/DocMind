import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

// Sentry(14일 트라이얼)는 데모 종료 후 연결 해제 — withSentryConfig 래퍼 제거로
// 빌드 시 소스맵 업로드·webpack 플러그인을 비활성화한다. 런타임 init 은 DSN 가드.
// 복원하려면 @sentry/nextjs 의 withSentryConfig 로 다시 감싸면 된다.
export default nextConfig;
