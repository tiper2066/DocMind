// Demo B 트리거 + 자율 루프 e2e 검증.
// 시드 URL 소스의 content_hash 를 'forced-<ts>' 센티넬로 바꿔 detect 의 라이브 재크롤·
// 5% 임계를 우회 → 오프라인·결정론적으로 5단계(detect→perceive→reason→act→learn)를 돌린다.
if (!process.env.INNGEST_DEV) process.env.INNGEST_DEV = "1";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  workspaces,
  sources,
  sourceChunks,
  documents,
  documentVersions,
  documentSources,
  agentRuns,
  agentEvents,
  approvals,
} from "../src/db/schema";
import { inngest } from "../src/inngest/client";
import { ensureMonitorAgent } from "../src/lib/agent/events";

const WORKSPACE_NAME = "Penta Security";
const DEMO_SOURCE_TITLE = "[demo] WAPPLES 제품 소개";
const DEMO_DOC_TITLE = "[demo] 자율루프 영업 제안서";
const POLL_INTERVAL_MS = 1500;
const TIMEOUT_MS = 60000;
const EXPECTED_PHASES = ["detect", "perceive", "reason", "act", "learn"];

const DEMO_CHUNKS = [
  "WAPPLES 는 펜타시큐리티의 지능형 웹 방화벽(WAF) 제품군이다.",
  "논리 연산 기반 탐지 엔진(COCEP)으로 알려지지 않은 공격을 차단한다.",
  "물리·가상·클라우드 어플라이언스 형태로 제공되어 다양한 환경에 배포된다.",
  "OWASP Top 10 및 주요 컴플라이언스 요건을 충족한다.",
  "2026 신규 릴리스에서 AI 기반 이상 트래픽 탐지 모듈이 추가되었다.",
];

const MINIMAL_DECK = {
  meta: {
    title: DEMO_DOC_TITLE,
    reader: "임원",
    cta: "계약 체결",
    objection: "가격",
    lengthPages: 4,
    securityLevel: 1,
    date: "2026-06-01",
  },
  slides: [
    { kind: "cover", title: DEMO_DOC_TITLE, subtitle: "WAPPLES 도입 제안" },
    {
      kind: "bullets",
      title: "도입 배경",
      bullets: [
        { text: "웹 공격 증가", level: 0 },
        { text: "컴플라이언스 요건", level: 0 },
      ],
    },
    {
      kind: "bullets",
      title: "제안",
      bullets: [
        { text: "WAPPLES WAF 도입", level: 0 },
        { text: "단계적 롤아웃", level: 0 },
      ],
    },
    { kind: "cta", headline: "도입 일정 협의", action: "담당자 미팅" },
  ],
  sourceRefs: [],
};

async function ensureWorkspace(): Promise<string> {
  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.name, WORKSPACE_NAME))
    .limit(1);
  if (ws) return ws.id;
  const [row] = await db
    .insert(workspaces)
    .values({ name: WORKSPACE_NAME })
    .returning({ id: workspaces.id });
  return row.id;
}

async function ensureSource(workspaceId: string): Promise<string> {
  const [existing] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(
      and(
        eq(sources.workspaceId, workspaceId),
        eq(sources.title, DEMO_SOURCE_TITLE),
      ),
    )
    .limit(1);

  let sourceId: string;
  if (existing) {
    sourceId = existing.id;
  } else {
    const [row] = await db
      .insert(sources)
      .values({
        workspaceId,
        kind: "url",
        url: "https://pentasecurity.com/products/wapples",
        title: DEMO_SOURCE_TITLE,
        summary: "WAPPLES 제품 소개 (데모 소스)",
        tags: ["waf", "wapples"],
        status: "ready",
        contentHash: "seed-hash",
      })
      .returning({ id: sources.id });
    sourceId = row.id;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sourceChunks)
    .where(eq(sourceChunks.sourceId, sourceId));
  if (count === 0) {
    await db.insert(sourceChunks).values(
      DEMO_CHUNKS.map((text, ord) => ({ sourceId, ord, text })),
    );
  }
  return sourceId;
}

async function ensureLinkedDocument(
  workspaceId: string,
  sourceId: string,
): Promise<string> {
  const [linked] = await db
    .select({ documentId: documentSources.documentId })
    .from(documentSources)
    .innerJoin(documents, eq(documents.id, documentSources.documentId))
    .where(
      and(
        eq(documentSources.sourceId, sourceId),
        eq(documents.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (linked) return linked.documentId;

  const [doc] = await db
    .insert(documents)
    .values({
      workspaceId,
      type: "proposal",
      title: DEMO_DOC_TITLE,
      status: "ready",
      reader: "임원",
      cta: "계약 체결",
      objection: "가격",
      lengthPages: 4,
    })
    .returning({ id: documents.id });

  await db.insert(documentVersions).values({
    documentId: doc.id,
    version: 1,
    status: "published",
    slidesJson: MINIMAL_DECK as object,
    changeNote: "initial generation (demo seed)",
  });

  await db
    .insert(documentSources)
    .values({ documentId: doc.id, sourceId, importance: 2 });

  return doc.id;
}

async function main() {
  const workspaceId = await ensureWorkspace();
  const sourceId = await ensureSource(workspaceId);
  const documentId = await ensureLinkedDocument(workspaceId, sourceId);
  const agentId = await ensureMonitorAgent(workspaceId);

  console.log(`workspace: ${workspaceId}`);
  console.log(`source:    ${sourceId}`);
  console.log(`document:  ${documentId}`);
  console.log(`agent:     ${agentId}\n`);

  const forcedHash = `forced-${Date.now()}`;
  await db
    .update(sources)
    .set({ contentHash: forcedHash })
    .where(eq(sources.id, sourceId));
  console.log(`forced content_hash → ${forcedHash}`);

  const triggerAt = new Date();
  await inngest.send({
    name: "agent/detect.requested",
    data: { workspaceId, agentId, sourceId },
  });
  console.log("event sent → agent/detect.requested\n");

  // 새 버전이 생겼는지 비교할 기준점 (act 가 만들 버전은 이보다 커야 함).
  const [baseVer] = await db
    .select({ version: documentVersions.version })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.version))
    .limit(1);
  const baseVersion = baseVer?.version ?? 0;

  const start = Date.now();
  let runId: string | null = null;
  const seen = new Set<string>();

  const pollEvents = async (rid: string): Promise<Set<string>> => {
    const evs = await db
      .select({ phase: agentEvents.phase, type: agentEvents.type })
      .from(agentEvents)
      .where(eq(agentEvents.runId, rid))
      .orderBy(agentEvents.ts);
    for (const e of evs) {
      const key = `${e.phase}:${e.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.log(
          `[${((Date.now() - start) / 1000).toFixed(1)}s] ${e.phase} → ${e.type}`,
        );
      }
    }
    return new Set(evs.map((e) => e.phase));
  };

  // ── A. 감지 단계 → regenerate 승인 카드 생성 대기 ──
  // (새 흐름: 루프는 감지에서 멈추고, 승인해야 인식 이후가 진행된다.)
  let regenApproval: { id: string; payload: unknown } | null = null;
  while (Date.now() - start < TIMEOUT_MS) {
    if (!runId) {
      const [run] = await db
        .select({ id: agentRuns.id })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.agentId, agentId),
            gte(agentRuns.startedAt, triggerAt),
          ),
        )
        .orderBy(desc(agentRuns.startedAt))
        .limit(1);
      if (run) {
        runId = run.id;
        console.log(`run started: ${runId}`);
      }
    }
    if (runId) {
      await pollEvents(runId);
      const [appr] = await db
        .select({ id: approvals.id, payload: approvals.payload })
        .from(approvals)
        .where(
          and(eq(approvals.runId, runId), eq(approvals.kind, "regenerate")),
        )
        .limit(1);
      if (appr) {
        regenApproval = appr;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!runId || !regenApproval) {
    console.error(`\n✗ 감지 단계/승인 카드가 ${TIMEOUT_MS / 1000}s 내 생성되지 않음`);
    process.exit(1);
  }
  console.log(
    `\n감지 완료 — regenerate 승인 대기 카드 생성 (${((Date.now() - start) / 1000).toFixed(1)}s)`,
  );

  // KEEP_PENDING: 데모용 — 감지 단계 승인 카드를 그대로 남긴다(발표자가 UI 에서
  // "발행 승인" 클릭 시 인식→판단→행동→학습 진행 + 자동 발행).
  if (process.env.KEEP_PENDING) {
    console.log(
      "  KEEP_PENDING=1 → 승인 생략. 에이전트 페이지에서 '발행 승인' 클릭 시 잔여 4단계가 진행됩니다.",
    );
    process.exit(0);
  }

  // ── B. 승인 시뮬레이션 (UI "발행 승인"과 동일) → 잔여 단계 재개 ──
  const rp = regenApproval.payload as {
    workspaceId: string;
    agentId: string;
    sourceId: string;
    previousHash: string | null;
    nextHash: string;
    changeRatio: number;
    newText: string;
    forced?: boolean;
  };
  await db
    .update(approvals)
    .set({ decision: "approve", decidedAt: new Date() })
    .where(eq(approvals.id, regenApproval.id));
  await inngest.send({
    name: "source.changed",
    data: {
      workspaceId: rp.workspaceId,
      agentId: rp.agentId,
      runId,
      sourceId: rp.sourceId,
      previousHash: rp.previousHash,
      nextHash: rp.nextHash,
      changeRatio: rp.changeRatio,
      newText: rp.newText,
      forced: rp.forced ?? false,
      approvedPublish: true,
    },
  });
  console.log("승인 → source.changed 발화 (인식→판단→행동→학습 재개)\n");

  // ── C. 5단계 완주 대기 ──
  const resumeStart = Date.now();
  let phases = new Set<string>();
  while (Date.now() - resumeStart < TIMEOUT_MS) {
    phases = await pollEvents(runId);
    if (EXPECTED_PHASES.every((p) => phases.has(p))) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const all5 = EXPECTED_PHASES.every((p) => phases.has(p));

  // 승인 선행 흐름이므로 act 가 published 신버전을 만들었는지 확인.
  const [latestVer] = await db
    .select({ version: documentVersions.version, status: documentVersions.status })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.version))
    .limit(1);
  const publishOk =
    !!latestVer &&
    latestVer.version > baseVersion &&
    latestVer.status === "published";

  console.log(`\nacceptance (${elapsed}s):`);
  console.log(`  5 phase events:    ${all5 ? "✓" : "✗"} (${[...phases].join(", ")})`);
  console.log(`  approve→regen:     ✓ (regenerate 승인 후 재개)`);
  console.log(
    `  published version: ${publishOk ? "✓" : "✗"} (v${latestVer?.version ?? "-"} ${latestVer?.status ?? "-"})`,
  );

  process.exit(all5 && publishOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
