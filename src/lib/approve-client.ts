// 클라 전용: pending 승인들을 기존 단일 approve 라우트로 fan-out. approve 라우트(데모 B 핵심)는 불변.
export async function approveAllPending(
  ids: string[],
): Promise<{ ok: number; total: number }> {
  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: id, decision: "approve" }),
      }),
    ),
  );
  const ok = results.filter(
    (r) => r.status === "fulfilled" && r.value.ok,
  ).length;
  return { ok, total: ids.length };
}
