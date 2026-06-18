import { Inngest } from "inngest";
import { z } from "zod";
import { UI_ONLY } from "@/lib/demo-mode";

export const inngest = new Inngest({ id: "docmind" });

// UI-only 데모: 이벤트 발화를 no-op 으로 단락한다(Inngest 키 없이도 API 라우트가
// 정상 200 반환, 백그라운드 처리는 안 됨 — 의도된 동작). 실서비스에선 그대로 전송.
export async function dispatch(
  ...args: Parameters<typeof inngest.send>
): Promise<void> {
  if (UI_ONLY) return;
  await inngest.send(...args);
}

export const SourceCrawlRequested = z.object({
  workspaceId: z.string().uuid(),
  sourceId: z.string().uuid(),
});

// Dev "지금 감지" 버튼 / cron 공용. data 없이 오면(=cron) 전 워크스페이스 스캔.
export const AgentDetectRequested = z.object({
  workspaceId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
});

// 최신 지식 및 동향 수집 — 스위치 ON 시 즉시 1회 + cron(12시·24시 KST).
export const TrendScanRequested = z.object({
  workspaceId: z.string().uuid().optional(),
});

// 자율 루프 이벤트 — runId 를 5단계(detect→perceive→reason→act→learn)에 관통.
export const SourceChanged = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid(),
  runId: z.string().uuid(),
  sourceId: z.string().uuid(),
  previousHash: z.string().nullable(),
  nextHash: z.string(),
  changeRatio: z.number(),
  newText: z.string(),
  forced: z.boolean().default(false),
  // 사용자가 감지 단계에서 이미 "발행 승인"을 했다는 표시 — act 가 2차 승인 없이
  // 자동 발행 + 알림 발송까지 수행한다.
  approvedPublish: z.boolean().default(false),
});

export const SourcePerceived = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid(),
  runId: z.string().uuid(),
  sourceId: z.string().uuid(),
  approvedPublish: z.boolean().default(false),
  perception: z.object({
    changeType: z.enum(["added", "removed", "modified", "mixed"]),
    summary: z.string(),
    sections: z.array(z.string()).default([]),
  }),
});

export const SourceImpactReady = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid(),
  runId: z.string().uuid(),
  sourceId: z.string().uuid(),
  approvedPublish: z.boolean().default(false),
  changeType: z.string(),
  impacts: z.array(
    z.object({
      documentId: z.string().uuid(),
      title: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      rationale: z.string(),
      shouldRegenerate: z.boolean(),
    }),
  ),
});

export const SourceActed = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid(),
  runId: z.string().uuid(),
  sourceId: z.string().uuid(),
  changeType: z.string(),
  results: z.array(
    z.object({
      documentId: z.string().uuid(),
      versionId: z.string().uuid(),
      version: z.number(),
      approvalId: z.string().uuid(),
      priority: z.string(),
    }),
  ),
});

export type SourceCrawlRequestedEvent = z.infer<typeof SourceCrawlRequested>;
export type AgentDetectRequestedEvent = z.infer<typeof AgentDetectRequested>;
export type SourceChangedEvent = z.infer<typeof SourceChanged>;
export type SourcePerceivedEvent = z.infer<typeof SourcePerceived>;
export type SourceImpactReadyEvent = z.infer<typeof SourceImpactReady>;
export type SourceActedEvent = z.infer<typeof SourceActed>;
