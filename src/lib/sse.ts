// 서버/클라 공용 SSE 유틸. db import 금지 (클라 번들 안전).

export type AgentEventMessage = {
  id: string;
  runId: string;
  phase: string;
  type: string;
  ts: string; // ISO
  payload: unknown;
};

// 서버: SSE 한 프레임 직렬화. id 를 넣으면 EventSource 가 Last-Event-ID 로 재구독에 사용.
export function formatSSE(opts: {
  id?: string;
  event?: string;
  data: unknown;
}): string {
  const lines: string[] = [];
  if (opts.id) lines.push(`id: ${opts.id}`);
  if (opts.event) lines.push(`event: ${opts.event}`);
  lines.push(`data: ${JSON.stringify(opts.data)}`);
  return lines.join("\n") + "\n\n";
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

// 클라: 에이전트 이벤트 스트림 구독. 반환값 호출 시 해제.
// 브라우저 전용 — "use client" 컴포넌트에서만 호출할 것.
export function subscribeAgentEvents(
  onMessage: (m: AgentEventMessage) => void,
  opts?: { since?: string; onError?: (e: Event) => void },
): () => void {
  const url = opts?.since
    ? `/api/events/stream?since=${encodeURIComponent(opts.since)}`
    : "/api/events/stream";
  const es = new EventSource(url);
  es.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data) as AgentEventMessage);
    } catch {
      /* malformed frame: ignore */
    }
  };
  if (opts?.onError) es.onerror = opts.onError;
  return () => es.close();
}
