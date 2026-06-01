import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ulid } from "ulid";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sourcesBucket = process.env.SUPABASE_BUCKET_SOURCES;
const pptxBucket = process.env.SUPABASE_BUCKET_PPTX;

if (!supabaseUrl) throw new Error("SUPABASE_URL is not set");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
if (!sourcesBucket) throw new Error("SUPABASE_BUCKET_SOURCES is not set");
if (!pptxBucket) throw new Error("SUPABASE_BUCKET_PPTX is not set");

const globalForSupabase = globalThis as unknown as {
  supabaseStorageClient?: SupabaseClient;
};

const supabase =
  globalForSupabase.supabaseStorageClient ??
  createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabaseStorageClient = supabase;
}

export const BUCKETS = {
  sources: sourcesBucket,
  pptx: pptxBucket,
} as const;

const DOWNLOAD_TTL_SECONDS = 5 * 60;

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 180) : `file_${Date.now()}`;
}

export function buildSourceKey(workspaceId: string, filename: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    throw new Error("Invalid workspaceId");
  }
  return `${workspaceId}/${ulid()}/${sanitizeFilename(filename)}`;
}

export async function createSourceUploadUrl(
  workspaceId: string,
  filename: string,
): Promise<{ key: string; signedUrl: string; token: string }> {
  const key = buildSourceKey(workspaceId, filename);
  const { data, error } = await supabase.storage
    .from(BUCKETS.sources)
    .createSignedUploadUrl(key);
  if (error || !data) {
    throw error ?? new Error("createSignedUploadUrl returned no data");
  }
  return { key, signedUrl: data.signedUrl, token: data.token };
}

export async function createSourceDownloadUrl(key: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKETS.sources)
    .createSignedUrl(key, DOWNLOAD_TTL_SECONDS);
  if (error || !data) {
    throw error ?? new Error("createSignedUrl returned no data");
  }
  return data.signedUrl;
}

export async function downloadSource(key: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage
    .from(BUCKETS.sources)
    .download(key);
  if (error || !data) {
    throw error ?? new Error("Storage download returned no data");
  }
  return await data.arrayBuffer();
}

export async function uploadPptx(
  key: string,
  body: ArrayBuffer | Uint8Array | Blob,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKETS.pptx)
    .upload(key, body, {
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      upsert: true,
    });
  if (error) throw error;
}

export async function createPptxDownloadUrl(key: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKETS.pptx)
    .createSignedUrl(key, DOWNLOAD_TTL_SECONDS);
  if (error || !data) {
    throw error ?? new Error("createSignedUrl returned no data");
  }
  return data.signedUrl;
}
