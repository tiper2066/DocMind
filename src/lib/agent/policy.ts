import type { agents } from "@/db/schema";

type AgentRow = typeof agents.$inferSelect;

export type AgentPolicy = {
  publish?: "manual" | "auto";
  notify?: "manual" | "auto";
};

export function getPolicy(agent: Pick<AgentRow, "configJson">): AgentPolicy {
  const cfg = (agent.configJson ?? {}) as { policy?: AgentPolicy };
  return cfg.policy ?? {};
}

// 워크스페이스 알림 채널 (설정에서 지정). 없으면 null → act 는 기본값 사용.
export function getNotifyChannel(
  agent: Pick<AgentRow, "configJson">,
): string | null {
  const cfg = (agent.configJson ?? {}) as { notifyChannel?: string };
  const c = cfg.notifyChannel?.trim();
  return c ? c : null;
}

// act 단계 발행 게이트. 기본은 manual(승인 큐만 생성).
// Slack/Email 발송은 정책과 무관하게 "항상 승인 후" (기획서 명시) — 여기서 자동 발행하지 않는다.
export function shouldAutoPublish(
  agent: Pick<AgentRow, "autoRun" | "configJson">,
): boolean {
  return agent.autoRun === true && getPolicy(agent).publish === "auto";
}
