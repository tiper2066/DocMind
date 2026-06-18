import Anthropic from "@anthropic-ai/sdk";

const globalForAnthropic = globalThis as unknown as {
  anthropicClient?: Anthropic;
};

// 지연 초기화: import 시점이 아니라 실제 호출 시점에만 키를 확인한다. UI-only
// 데모 모드(키 제거)에서 이 모듈을 import 만 하고 호출하지 않을 때 크래시 방지.
function getClient(): Anthropic {
  if (globalForAnthropic.anthropicClient) return globalForAnthropic.anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey });
  if (process.env.NODE_ENV !== "production") {
    globalForAnthropic.anthropicClient = client;
  }
  return client;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
}) as Anthropic;

export const MODELS = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
  haiku: "claude-haiku-4-5-20251001",
} as const;

export type ModelKey = keyof typeof MODELS;

type CacheableBlock = Anthropic.TextBlockParam;

export function cachedText(text: string): CacheableBlock {
  return {
    type: "text",
    text,
    cache_control: { type: "ephemeral" },
  };
}

export function systemWithCache(
  parts: ReadonlyArray<string | CacheableBlock>,
): CacheableBlock[] {
  return parts.map((p) =>
    typeof p === "string" ? cachedText(p) : p,
  );
}

export function contextBlock(label: string, content: string): CacheableBlock {
  return cachedText(`<${label}>\n${content}\n</${label}>`);
}
