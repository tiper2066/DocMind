// 데모 KB 시드. Demo A(인터뷰→PPT)·검증 #2(KB URL)·#3(KB 파일 4종)용 베이스라인을
// 채운다. 멱등(이미 있는 소스는 건너뜀) + 파일 단건 실패는 비치명(로그 후 계속).
// Demo B(자율 루프)는 force-change.ts 가 자체 [demo] 소스를 따로 심으므로 여기선 다루지 않음.
//
// 실행: pnpm db:seed 로 워크스페이스 생성 후, INNGEST_DEV=1 pnpm dev + pnpm inngest 가
// 떠 있는 상태에서  pnpm seed:demo  (크롤은 Inngest 워커가 처리).
if (!process.env.INNGEST_DEV) process.env.INNGEST_DEV = "1";

import { and, eq, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { createClient } from "@supabase/supabase-js";
import { db } from "../src/db/client";
import { sources, sourceChunks, workspaces } from "../src/db/schema";
import { inngest } from "../src/inngest/client";

const WORKSPACE_NAME = "Penta Security";
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 240000;

const WAPPLES_URL = "https://pentasecurity.com/products/wapples";

// 파일 소스: 공개 URL 에서 받아 Storage 에 올린 뒤 크롤. 데모 당일엔 실제 사내/금융
// 자료 URL 로 교체할 것. 404 등 단건 실패는 건너뛴다(부분 시드 허용).
// 형식 커버리지(검증 #3): pdf / pptx / docx / xlsx 각 1건 이상 권장.
const DEMO_FILES: Array<{ title: string; url: string }> = [
  { title: "Bitcoin 백서 (PDF 샘플)", url: "https://bitcoin.org/bitcoin.pdf" },
  // TODO(데모팀): 아래를 실제 금융 PDF / 경쟁사 PPTX / DOCX / XLSX 공개 URL 로 교체.
  // { title: "금융 보안 동향 (PDF)", url: "https://.../finance.pdf" },
  // { title: "경쟁사 제품 비교 (PPTX)", url: "https://.../competitor.pptx" },
  // { title: "보안 점검 체크리스트 (DOCX)", url: "https://.../checklist.docx" },
  // { title: "도입 효과 지표 (XLSX)", url: "https://.../metrics.xlsx" },
];

const SUPPORTED_EXT = ["pdf", "docx", "xlsx", "pptx"] as const;

function log(msg: string) {
  console.log(`[seed-demo] ${msg}`);
}

function makeSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getWorkspaceId(): Promise<string> {
  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.name, WORKSPACE_NAME))
    .limit(1);
  if (!ws) {
    throw new Error(
      `workspace "${WORKSPACE_NAME}" 없음. 먼저 pnpm db:seed 실행.`,
    );
  }
  return ws.id;
}

// url 소스: 이미 같은 url 이 있으면 그 id, 없으면 새로 만들고 크롤 요청.
async function ensureUrlSource(workspaceId: string, url: string): Promise<string> {
  const [existing] = await db
    .select({ id: sources.id, status: sources.status })
    .from(sources)
    .where(and(eq(sources.workspaceId, workspaceId), eq(sources.url, url)))
    .limit(1);
  if (existing) {
    log(`URL 이미 존재(${existing.status}): ${url} → skip`);
    return existing.id;
  }
  const [src] = await db
    .insert(sources)
    .values({ workspaceId, kind: "url", url, status: "crawling" })
    .returning({ id: sources.id });
  await inngest.send({
    name: "source/crawl.requested",
    data: { workspaceId, sourceId: src.id },
  });
  log(`URL 크롤 요청: ${url} (source=${src.id})`);
  return src.id;
}

// 파일 소스: 같은 title 이 있으면 skip. 없으면 다운로드→Storage 업로드→크롤 요청.
async function ensureFileSource(
  workspaceId: string,
  supabase: ReturnType<typeof makeSupabase>,
  bucket: string,
  title: string,
  url: string,
): Promise<string | null> {
  const [existing] = await db
    .select({ id: sources.id, status: sources.status })
    .from(sources)
    .where(and(eq(sources.workspaceId, workspaceId), eq(sources.title, title)))
    .limit(1);
  if (existing) {
    log(`파일 이미 존재(${existing.status}): ${title} → skip`);
    return existing.id;
  }

  const res = await fetch(url);
  if (!res.ok) {
    log(`⚠ 다운로드 실패 HTTP ${res.status}: ${url} → skip`);
    return null;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const filename = url.split("/").pop()?.split("?")[0] ?? "file";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!(SUPPORTED_EXT as readonly string[]).includes(ext)) {
    log(`⚠ 미지원 확장자 .${ext}: ${url} → skip`);
    return null;
  }

  const key = `${workspaceId}/${ulid()}/${filename}`;
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(key, buf, {
      contentType: res.headers.get("content-type") ?? undefined,
    });
  if (upErr) {
    log(`⚠ 업로드 실패: ${title}: ${upErr.message} → skip`);
    return null;
  }

  const [src] = await db
    .insert(sources)
    .values({ workspaceId, kind: "file", fileKey: key, title, status: "crawling" })
    .returning({ id: sources.id });
  await inngest.send({
    name: "source/crawl.requested",
    data: { workspaceId, sourceId: src.id },
  });
  log(`파일 크롤 요청: ${title} (${buf.byteLength}B .${ext}, source=${src.id})`);
  return src.id;
}

async function pollReady(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const start = Date.now();
  const pending = new Set(ids);
  while (pending.size > 0 && Date.now() - start < TIMEOUT_MS) {
    for (const id of [...pending]) {
      const [row] = await db
        .select({ status: sources.status, title: sources.title })
        .from(sources)
        .where(eq(sources.id, id))
        .limit(1);
      if (!row) {
        pending.delete(id);
        continue;
      }
      if (row.status === "ready") {
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(sourceChunks)
          .where(eq(sourceChunks.sourceId, id));
        log(`✓ ready: ${row.title} (chunks=${n})`);
        pending.delete(id);
      } else if (row.status === "error") {
        log(`✗ error: ${row.title}`);
        pending.delete(id);
      }
    }
    if (pending.size > 0) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (pending.size > 0) {
    log(`⚠ 타임아웃 — 아직 처리 중 ${pending.size}건 (Inngest 워커 동작 확인)`);
  }
}

async function main() {
  const workspaceId = await getWorkspaceId();
  log(`workspace: ${workspaceId}`);

  const supabase = makeSupabase();
  const bucket = process.env.SUPABASE_BUCKET_SOURCES!;

  const ids: string[] = [];
  ids.push(await ensureUrlSource(workspaceId, WAPPLES_URL));
  for (const f of DEMO_FILES) {
    const id = await ensureFileSource(workspaceId, supabase, bucket, f.title, f.url);
    if (id) ids.push(id);
  }

  log(`크롤 대기 중 (${ids.length}건)...`);
  await pollReady(ids);
  log("완료.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
