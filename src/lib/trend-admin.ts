import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

// 이메일 화이트리스트 게이트 공통 규칙:
// env 값이 비어 있거나 미설정이면 모두 허용(데모 기본) — 설정하는 순간 목록만 허용.
// 쉼표 구분 다수, 공백 허용, 대소문자 무시.
function emailAllowedBy(
  envRaw: string | undefined,
  email: string | null | undefined,
): boolean {
  const raw = envRaw?.trim();
  if (!raw) return true;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

async function emailOf(userId: string): Promise<string | null> {
  const [u] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u?.email ?? null;
}

// "최신 지식 및 동향 검색" 스위치 토글 권한 (TREND_ADMIN_EMAILS).
export function trendAdminAllowed(email: string | null | undefined): boolean {
  return emailAllowedBy(process.env.TREND_ADMIN_EMAILS, email);
}

export async function canToggleTrend(userId: string): Promise<boolean> {
  if (!process.env.TREND_ADMIN_EMAILS?.trim()) return true;
  return trendAdminAllowed(await emailOf(userId));
}

// 에이전트 액션(발행 승인·승인 거부·지금 감지) 권한 (APPROVAL_ADMIN_EMAILS).
// 데모 중 다른 사용자가 대기 문서를 소진하는 것을 방지.
export function approvalAdminAllowed(
  email: string | null | undefined,
): boolean {
  return emailAllowedBy(process.env.APPROVAL_ADMIN_EMAILS, email);
}

export async function canUseApprovalActions(userId: string): Promise<boolean> {
  if (!process.env.APPROVAL_ADMIN_EMAILS?.trim()) return true;
  return approvalAdminAllowed(await emailOf(userId));
}
