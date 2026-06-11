import { and, desc, eq } from "drizzle-orm";

import {
  inngest,
  AgentDetectRequested,
  SourceChanged,
  SourcePerceived,
  SourceImpactReady,
  SourceActed,
} from "./client";
import {
  loadSource,
  dispatchParse,
  sha256,
} from "./functions";
import { db } from "@/db/client";
import {
  sources,
  documents,
  documentVersions,
  documentSources,
  approvals,
  notifications,
  learningPatterns,
  agents,
  schedules,
} from "@/db/schema";
import { anthropic, MODELS, systemWithCache, contextBlock } from "@/lib/anthropic";
import { embed } from "@/lib/embeddings";
import { generateDeck, normalizeDocumentSources } from "@/lib/ppt/generate";
import { cronMatches } from "@/lib/cron";
import { ScheduleTemplate, templateLengthPages } from "@/lib/schedule";
import {
  appendEvent,
  endRun,
  startRun,
  ensureMonitorAgent,
  reconstructSourceText,
  changeRatio,
} from "@/lib/agent/events";
import { shouldAutoPublish, getNotifyChannel } from "@/lib/agent/policy";
import {
  DIFF_PERCEIVE_SYSTEM,
  CLASSIFY_CHANGE_TOOL,
  type ClassifyChangeInput,
} from "@/lib/prompts/diff-perceive";
import {
  IMPACT_RANK_SYSTEM,
  RANK_IMPACT_TOOL,
  type RankImpactInput,
} from "@/lib/prompts/impact-rank";

const CHANGE_THRESHOLD = 0.05;
const FORCED_PREFIX = "forced-";

// 원본 이벤트 페이로드에서 runId 추출 (v4 onFailure 래퍼: event.data.event.data).
function origRunId(event: { data?: unknown }): string | null {
  const wrapper = event.data as { event?: { data?: { runId?: string } } };
  return wrapper?.event?.data?.runId ?? null;
}

async function failRun(event: { data?: unknown }): Promise<void> {
  const runId = origRunId(event);
  if (runId) await endRun(runId, "failed");
}

// ─────────────────────────────────────────────────────────────
// agent.detect — 재크롤 + content_hash 비교 + 5% 임계 → source.changed
// ─────────────────────────────────────────────────────────────
export const agentDetect = inngest.createFunction(
  {
    id: "agent-detect",
    name: "Agent · detect",
    retries: 1,
    triggers: [
      { cron: "*/30 * * * *" },
      { event: "agent/detect.requested" },
    ],
  },
  async ({ event, step }) => {
    const data = AgentDetectRequested.parse(event.data ?? {});

    const candidates = await step.run("scan", async () => {
      const rows = await db
        .select({
          id: sources.id,
          workspaceId: sources.workspaceId,
          kind: sources.kind,
          origin: sources.origin,
          contentHash: sources.contentHash,
        })
        .from(sources)
        .where(eq(sources.status, "ready"));
      return rows.filter((r) => {
        if (data.workspaceId && r.workspaceId !== data.workspaceId) return false;
        // 명시적 트리거(소스 "수정" 등 sourceId 지정)면 그 소스만 — 종류 무관(파일 포함).
        // cron 자동 스캔(sourceId 없음)은 외부에서 바뀌는 URL 소스만 재크롤한다.
        if (data.sourceId) return r.id === data.sourceId;
        // trend(자동 수집) 소스는 외부 기사라 자주 바뀜 — 변경 감지 대상에서 제외해
        // 승인 큐 노이즈를 막는다 (RAG 검색에는 정상 참여).
        return r.kind === "url" && r.origin !== "trend";
      });
    });

    const changedPayloads: Array<{
      name: "source.changed";
      data: Record<string, unknown>;
    }> = [];

    for (const cand of candidates) {
      const result = await step.run(`detect-${cand.id}`, async () => {
        const oldHash = cand.contentHash;
        const forced = !!oldHash && oldHash.startsWith(FORCED_PREFIX);

        let newText: string;
        let newHash: string;
        let ratio: number;

        if (forced) {
          newText = await reconstructSourceText(cand.id);
          newHash = sha256(`${newText}:${Date.now()}`);
          ratio = 1;
        } else {
          const row = await loadSource(cand.workspaceId, cand.id);
          let parsed;
          try {
            parsed = await dispatchParse(row);
          } catch (e) {
            // 라이브 재크롤 실패는 이 소스만 스킵 (cron 전체를 막지 않음).
            console.warn(`[detect] re-crawl failed for ${cand.id}:`, e);
            return null;
          }
          newText = parsed.text.trim();
          newHash = sha256(newText);
          if (newHash === oldHash) return null; // 변경 없음
          const oldText = await reconstructSourceText(cand.id);
          ratio = changeRatio(oldText, newText);
          if (ratio < CHANGE_THRESHOLD) {
            await db
              .update(sources)
              .set({ contentHash: newHash, lastCrawledAt: new Date() })
              .where(eq(sources.id, cand.id));
            return null; // 임계 미만 → 조용히 갱신
          }
        }

        const agentId = data.agentId ?? (await ensureMonitorAgent(cand.workspaceId));
        const runId = await startRun(
          agentId,
          forced ? "manual" : "cron",
          `source ${cand.id} changed (${(ratio * 100).toFixed(0)}%)`,
        );
        await appendEvent(runId, "detect", "source.changed", {
          sourceId: cand.id,
          previousHash: oldHash,
          nextHash: newHash,
          changeRatio: ratio,
          forced,
        });
        // 같은 변경을 다음 cron 에서 재감지하지 않도록 hash 갱신.
        await db
          .update(sources)
          .set({ contentHash: newHash, lastCrawledAt: new Date() })
          .where(eq(sources.id, cand.id));

        return {
          workspaceId: cand.workspaceId,
          agentId,
          runId,
          sourceId: cand.id,
          previousHash: oldHash,
          nextHash: newHash,
          changeRatio: ratio,
          newText: newText.slice(0, 8000),
          forced,
        };
      });

      if (result) {
        changedPayloads.push({ name: "source.changed", data: result });
      }
    }

    if (changedPayloads.length > 0) {
      await step.sendEvent("emit-changed", changedPayloads);
    }

    return { scanned: candidates.length, changed: changedPayloads.length };
  },
);

// ─────────────────────────────────────────────────────────────
// agent.perceive — 변경 섹션 분류 (Claude) → source.perceived
// ─────────────────────────────────────────────────────────────
export const agentPerceive = inngest.createFunction(
  {
    id: "agent-perceive",
    name: "Agent · perceive",
    retries: 1,
    triggers: [{ event: "source.changed" }],
    onFailure: async ({ event }) => failRun(event),
  },
  async ({ event, step }) => {
    const data = SourceChanged.parse(event.data);

    const perception = await step.run("classify", async () => {
      const [src] = await db
        .select({ title: sources.title })
        .from(sources)
        .where(eq(sources.id, data.sourceId))
        .limit(1);

      const res = await anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 600,
        system: systemWithCache([DIFF_PERCEIVE_SYSTEM]),
        tools: [CLASSIFY_CHANGE_TOOL],
        tool_choice: { type: "tool", name: "classify_change" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `<sourceTitle>${src?.title ?? "(제목 없음)"}</sourceTitle>\n<changeRatio>${(data.changeRatio * 100).toFixed(0)}%</changeRatio>`,
              },
              contextBlock("sourceContent", data.newText.slice(0, 6000)),
              {
                type: "text",
                text: "위 소스의 변경을 classify_change 도구로 분류하라.",
              },
            ],
          },
        ],
      });

      const toolUse = res.content.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("classify_change tool_use missing");
      }
      const out = toolUse.input as ClassifyChangeInput;
      const perception = {
        changeType: out.changeType ?? "modified",
        summary: out.summary ?? "",
        sections: Array.isArray(out.sections) ? out.sections : [],
      };
      await appendEvent(data.runId, "perceive", "source.perceived", perception);
      return perception;
    });

    await step.sendEvent("emit-perceived", {
      name: "source.perceived",
      data: {
        workspaceId: data.workspaceId,
        agentId: data.agentId,
        runId: data.runId,
        sourceId: data.sourceId,
        perception,
      },
    });

    return { ok: true, changeType: perception.changeType };
  },
);

// ─────────────────────────────────────────────────────────────
// agent.reason — 영향 문서/우선순위 (Opus 4.7) → source.impact-ready
// ─────────────────────────────────────────────────────────────
export const agentReason = inngest.createFunction(
  {
    id: "agent-reason",
    name: "Agent · reason",
    retries: 1,
    triggers: [{ event: "source.perceived" }],
    onFailure: async ({ event }) => failRun(event),
  },
  async ({ event, step }) => {
    const data = SourcePerceived.parse(event.data);

    type Impact = {
      documentId: string;
      title: string;
      priority: "high" | "medium" | "low";
      rationale: string;
      shouldRegenerate: boolean;
    };

    const impacts = await step.run("rank", async (): Promise<Impact[]> => {
      const docs = await db
        .select({
          id: documents.id,
          title: documents.title,
          type: documents.type,
          reader: documents.reader,
          cta: documents.cta,
          objection: documents.objection,
        })
        .from(documentSources)
        .innerJoin(documents, eq(documents.id, documentSources.documentId))
        .where(
          and(
            eq(documentSources.sourceId, data.sourceId),
            eq(documents.workspaceId, data.workspaceId),
          ),
        );

      if (docs.length === 0) {
        await appendEvent(data.runId, "reason", "source.impact-ready", {
          impacts: [],
          note: "no referencing documents",
        });
        return [];
      }

      const docList = docs
        .map(
          (d) =>
            `- documentId=${d.id} | type=${d.type} | title=${d.title} | reader=${d.reader ?? "-"} | cta=${d.cta ?? "-"} | objection=${d.objection ?? "-"}`,
        )
        .join("\n");

      const res = await anthropic.messages.create({
        model: MODELS.opus,
        max_tokens: 900,
        system: systemWithCache([IMPACT_RANK_SYSTEM]),
        tools: [RANK_IMPACT_TOOL],
        tool_choice: { type: "tool", name: "rank_impact" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `<changeType>${data.perception.changeType}</changeType>\n<changeSummary>${data.perception.summary}</changeSummary>\n<changedSections>${data.perception.sections.join(", ")}</changedSections>`,
              },
              contextBlock("referencingDocuments", docList),
              {
                type: "text",
                text: "각 문서의 영향도를 rank_impact 도구로 판단하라.",
              },
            ],
          },
        ],
      });

      const toolUse = res.content.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("rank_impact tool_use missing");
      }
      const out = toolUse.input as RankImpactInput;
      const validIds = new Set(docs.map((d) => d.id));
      const titleById = new Map(docs.map((d) => [d.id, d.title]));
      const impacts = (out.impacts ?? [])
        .filter((i) => validIds.has(i.documentId))
        .map((i) => ({
          documentId: i.documentId,
          title: titleById.get(i.documentId) ?? "",
          priority: i.priority,
          rationale: i.rationale,
          shouldRegenerate: i.shouldRegenerate,
        }));

      await appendEvent(data.runId, "reason", "source.impact-ready", {
        impacts,
      });
      return impacts;
    });

    await step.sendEvent("emit-impact-ready", {
      name: "source.impact-ready",
      data: {
        workspaceId: data.workspaceId,
        agentId: data.agentId,
        runId: data.runId,
        sourceId: data.sourceId,
        changeType: data.perception.changeType,
        impacts: impacts.map((i) => ({
          documentId: i.documentId,
          title: i.title,
          priority: i.priority,
          rationale: i.rationale,
          shouldRegenerate: i.shouldRegenerate,
        })),
      },
    });

    return { ok: true, impacted: impacts.length };
  },
);

// ─────────────────────────────────────────────────────────────
// agent.act — 신버전 드래프트 + 승인 큐 (+ Slack 보류) → source.acted
// ─────────────────────────────────────────────────────────────
export const agentAct = inngest.createFunction(
  {
    id: "agent-act",
    name: "Agent · act",
    retries: 1,
    triggers: [{ event: "source.impact-ready" }],
    onFailure: async ({ event }) => failRun(event),
  },
  async ({ event, step }) => {
    const data = SourceImpactReady.parse(event.data);

    const policy = await step.run("load-policy", async () => {
      const [agent] = await db
        .select({ autoRun: agents.autoRun, configJson: agents.configJson })
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .limit(1);
      return {
        autoPublish: agent ? shouldAutoPublish(agent) : false,
        notifyChannel: agent ? getNotifyChannel(agent) : null,
      };
    });
    const autoPublish = policy.autoPublish;

    const targets = data.impacts.filter((i) => i.shouldRegenerate);

    const results: Array<{
      documentId: string;
      versionId: string;
      version: number;
      approvalId: string;
      priority: string;
    }> = [];

    for (const impact of targets) {
      const r = await step.run(`act-${impact.documentId}`, async () => {
        // 최신 버전을 clone 한 draft 신버전 생성 (전체 재생성은 후속 — 30s 예산 보호).
        const [base] = await db
          .select({
            version: documentVersions.version,
            slidesJson: documentVersions.slidesJson,
          })
          .from(documentVersions)
          .where(eq(documentVersions.documentId, impact.documentId))
          .orderBy(desc(documentVersions.version))
          .limit(1);
        if (!base) return null;

        const nextVersion = base.version + 1;
        const changeNote = `소스 변경 자동 반영 (${data.changeType}) · ${impact.rationale}`;

        const [ver] = await db
          .insert(documentVersions)
          .values({
            documentId: impact.documentId,
            version: nextVersion,
            status: autoPublish ? "published" : "draft",
            slidesJson: base.slidesJson as object,
            changeNote,
          })
          .returning({ id: documentVersions.id, version: documentVersions.version });

        const [appr] = await db
          .insert(approvals)
          .values({
            runId: data.runId,
            documentId: impact.documentId,
            kind: "publish",
            payload: {
              versionId: ver.id,
              version: ver.version,
              sourceId: data.sourceId,
              priority: impact.priority,
              changeType: data.changeType,
              changeNote,
            },
            ...(autoPublish
              ? { decision: "approve", decidedAt: new Date() }
              : {}),
          })
          .returning({ id: approvals.id });

        // Slack 발송은 Phase 6. 여기서는 pending 이력만 남긴다(승인 후 발송).
        await db.insert(notifications).values({
          workspaceId: data.workspaceId,
          channel: "slack",
          target: policy.notifyChannel ?? "#docmind-demo",
          status: "pending",
          relatedRunId: data.runId,
          payload: {
            documentId: impact.documentId,
            versionId: ver.id,
            version: ver.version,
            title: impact.title,
            changeNote,
            approvalId: appr.id,
          },
        });

        if (autoPublish) {
          await db
            .update(documents)
            .set({ status: "ready", updatedAt: new Date() })
            .where(eq(documents.id, impact.documentId));
        }

        return {
          documentId: impact.documentId,
          versionId: ver.id,
          version: ver.version,
          approvalId: appr.id,
          priority: impact.priority,
        };
      });
      if (r) results.push(r);
    }

    await step.run("record-acted", async () => {
      await appendEvent(data.runId, "act", "source.acted", {
        results,
        autoPublish,
      });
    });

    await step.sendEvent("emit-acted", {
      name: "source.acted",
      data: {
        workspaceId: data.workspaceId,
        agentId: data.agentId,
        runId: data.runId,
        sourceId: data.sourceId,
        changeType: data.changeType,
        results,
      },
    });

    return { ok: true, acted: results.length };
  },
);

// ─────────────────────────────────────────────────────────────
// agent.learn — pattern 벡터 upsert (learning_patterns) → run 종료
// ─────────────────────────────────────────────────────────────
export const agentLearn = inngest.createFunction(
  {
    id: "agent-learn",
    name: "Agent · learn",
    retries: 1,
    triggers: [{ event: "source.acted" }],
    onFailure: async ({ event }) => failRun(event),
  },
  async ({ event, step }) => {
    const data = SourceActed.parse(event.data);

    await step.run("learn", async () => {
      const [src] = await db
        .select({ title: sources.title })
        .from(sources)
        .where(eq(sources.id, data.sourceId))
        .limit(1);

      const priorities = data.results.map((r) => r.priority).join(",");
      const patternText = `source=${src?.title ?? data.sourceId} changeType=${data.changeType} affectedDocs=${data.results.length} priorities=${priorities || "none"}`;

      let embedding: number[] | undefined;
      try {
        [embedding] = await embed([patternText], "document");
      } catch (e) {
        console.warn("[learn] embed failed; storing pattern without vector:", e);
      }

      const [row] = await db
        .insert(learningPatterns)
        .values({
          workspaceId: data.workspaceId,
          sourceId: data.sourceId,
          runId: data.runId,
          changeType: data.changeType,
          patternText,
          embedding: embedding ?? null,
          outcome: "pending",
        })
        .returning({ id: learningPatterns.id });

      await appendEvent(data.runId, "learn", "source.learned", {
        patternId: row.id,
        affectedDocs: data.results.length,
      });
    });

    await endRun(
      data.runId,
      "succeeded",
      `loop complete · ${data.results.length} document(s) drafted`,
    );

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────
// agent.generate.scheduled (Mode C) — 매분 틱 + 등록 schedule cron 매칭 → 생성
// ─────────────────────────────────────────────────────────────
export const agentGenerateScheduled = inngest.createFunction(
  {
    id: "agent-generate-scheduled",
    name: "Agent · scheduled generate",
    retries: 0, // 놓친 분은 다음 틱에. 재시도로 중복 생성 방지.
    triggers: [{ cron: "* * * * *" }],
  },
  async ({ step }) => {
    const due = await step.run("load-due", async () => {
      const now = new Date();
      const rows = await db
        .select({
          id: schedules.id,
          workspaceId: schedules.workspaceId,
          cron: schedules.cron,
          template: schedules.documentTemplateJson,
        })
        .from(schedules)
        .where(eq(schedules.enabled, true));
      return rows.filter((r) => cronMatches(r.cron, now));
    });

    const results: Array<{ scheduleId: string; documentId: string }> = [];

    for (const s of due) {
      const r = await step.run(`gen-${s.id}`, async () => {
        const parsed = ScheduleTemplate.safeParse(s.template);
        if (!parsed.success) {
          console.warn(`[scheduled] schedule ${s.id} has invalid template`);
          return null;
        }
        const t = parsed.data;
        const lengthPages = templateLengthPages(t.length);

        const [doc] = await db
          .insert(documents)
          .values({
            workspaceId: s.workspaceId,
            type: t.type,
            title: t.title,
            status: "ready",
            reader: t.reader,
            cta: t.cta,
            objection: t.objection,
            lengthPages,
          })
          .returning({ id: documents.id });

        const deck = await generateDeck({
          workspaceId: s.workspaceId,
          documentId: doc.id,
          documentType: t.type,
          documentTitle: t.title,
          answers: {
            reader: t.reader,
            cta: t.cta,
            objection: t.objection,
            keyMessage: t.keyMessage,
            length: t.length,
          },
          lengthPages,
          securityLevel: t.securityLevel,
        });

        const [ver] = await db
          .insert(documentVersions)
          .values({
            documentId: doc.id,
            version: 1,
            status: "published",
            slidesJson: deck as unknown as object,
            changeNote: "scheduled generation",
          })
          .returning({ id: documentVersions.id });

        await normalizeDocumentSources(doc.id, deck);

        // 결과 Slack 공유 의향 기록 (실제 발송은 Phase 6 dispatch 와 동일 정책 — 후속).
        await db.insert(notifications).values({
          workspaceId: s.workspaceId,
          channel: "slack",
          target: "#docmind-demo",
          status: "pending",
          payload: {
            kind: "scheduled.generated",
            scheduleId: s.id,
            documentId: doc.id,
            versionId: ver.id,
            title: t.title,
          },
        });

        return { scheduleId: s.id, documentId: doc.id };
      });
      if (r) results.push(r);
    }

    return { due: due.length, generated: results.length };
  },
);

export const agentFunctions = [
  agentDetect,
  agentPerceive,
  agentReason,
  agentAct,
  agentLearn,
  agentGenerateScheduled,
];
