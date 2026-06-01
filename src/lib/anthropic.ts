import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

const globalForAnthropic = globalThis as unknown as {
  anthropicClient?: Anthropic;
};

export const anthropic =
  globalForAnthropic.anthropicClient ?? new Anthropic({ apiKey });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropicClient = anthropic;
}

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
