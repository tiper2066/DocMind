import pLimit from "p-limit";

const apiKey = process.env.VOYAGE_API_KEY;
if (!apiKey) {
  throw new Error("VOYAGE_API_KEY is not set");
}

export const EMBED_MODEL = "voyage-3";
export const EMBED_DIM = 1024;
const BATCH_SIZE = 128;
const CONCURRENCY = 5;
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const RATE_LIMIT_BACKOFF_MS = 25_000;
const CACHE_MAX = 256;

const limit = pLimit(CONCURRENCY);

export type EmbedInputType = "document" | "query";

type EmbedResponse = {
  data?: Array<{ index?: number; embedding?: number[] }>;
  detail?: string;
};

const queryCache = new Map<string, number[]>();

function cacheKey(text: string, inputType: EmbedInputType): string {
  return `${inputType}:${text}`;
}

function cacheGet(text: string, inputType: EmbedInputType): number[] | undefined {
  return queryCache.get(cacheKey(text, inputType));
}

function cacheSet(text: string, inputType: EmbedInputType, v: number[]): void {
  if (queryCache.size >= CACHE_MAX) {
    const first = queryCache.keys().next().value;
    if (first) queryCache.delete(first);
  }
  queryCache.set(cacheKey(text, inputType), v);
}

async function callVoyage(
  batch: string[],
  inputType: EmbedInputType,
  attempt = 0,
): Promise<number[][]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: batch,
      model: EMBED_MODEL,
      input_type: inputType,
    }),
  });

  if (res.status === 429 && attempt < 1) {
    const body = await res.text().catch(() => "");
    console.warn(
      `[voyage] 429 rate limited (attempt ${attempt + 1}); waiting ${RATE_LIMIT_BACKOFF_MS / 1000}s. ${body.slice(0, 200)}`,
    );
    await new Promise((r) => setTimeout(r, RATE_LIMIT_BACKOFF_MS));
    return callVoyage(batch, inputType, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`voyage ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as EmbedResponse;
  const data = json.data ?? [];
  if (data.length !== batch.length) {
    throw new Error(
      `voyage returned ${data.length} embeddings for ${batch.length} inputs`,
    );
  }
  const ordered = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return ordered.map((d) => {
    if (!d.embedding) throw new Error("voyage returned empty embedding");
    if (d.embedding.length !== EMBED_DIM) {
      throw new Error(
        `expected ${EMBED_DIM}-dim vector, got ${d.embedding.length}`,
      );
    }
    return d.embedding;
  });
}

export async function embed(
  texts: string[],
  inputType: EmbedInputType = "document",
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const out: (number[] | null)[] = new Array(texts.length).fill(null);
  const missingIdx: number[] = [];
  const missingTexts: string[] = [];

  if (inputType === "query") {
    texts.forEach((t, i) => {
      const cached = cacheGet(t, inputType);
      if (cached) {
        out[i] = cached;
      } else {
        missingIdx.push(i);
        missingTexts.push(t);
      }
    });
  } else {
    missingIdx.push(...texts.map((_, i) => i));
    missingTexts.push(...texts);
  }

  if (missingTexts.length > 0) {
    const batches: string[][] = [];
    for (let i = 0; i < missingTexts.length; i += BATCH_SIZE) {
      batches.push(missingTexts.slice(i, i + BATCH_SIZE));
    }
    const batchResults = await Promise.all(
      batches.map((b) => limit(() => callVoyage(b, inputType))),
    );
    const flat = batchResults.flat();
    flat.forEach((v, j) => {
      const idx = missingIdx[j];
      out[idx] = v;
      if (inputType === "query") cacheSet(missingTexts[j], inputType, v);
    });
  }

  return out.map((v, i) => {
    if (!v) throw new Error(`embedding ${i} missing`);
    return v;
  });
}

export async function embedOne(
  text: string,
  inputType: EmbedInputType = "query",
): Promise<number[]> {
  const [v] = await embed([text], inputType);
  return v;
}
