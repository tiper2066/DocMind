import { WebClient } from "@slack/web-api";
import type { KnownBlock } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN;

const globalForSlack = globalThis as unknown as { slackClient?: WebClient };

function client(): WebClient | null {
  if (!token || token.startsWith("xoxb-0000")) return null; // 미설정/placeholder
  const c = globalForSlack.slackClient ?? new WebClient(token);
  if (process.env.NODE_ENV !== "production") globalForSlack.slackClient = c;
  return c;
}

export function isSlackConfigured(): boolean {
  return client() !== null;
}

// 채널 우선순위: 명시 target(ID) > SLACK_DEFAULT_CHANNEL_ID > target 문자열(#name)
export function resolveChannel(target?: string | null): string | null {
  const def = process.env.SLACK_DEFAULT_CHANNEL_ID;
  if (target && target.startsWith("C")) return target;
  if (def && !def.startsWith("C0XXXX")) return def;
  return target ?? null;
}

export type PublishNotice = {
  documentTitle: string;
  version: number;
  changeNote?: string | null;
  approvalUrl: string;
  decidedByEmail?: string | null;
};

export function buildPublishBlocks(n: PublishNotice): KnownBlock[] {
  const lines = [
    n.changeNote ? `*변경 요약*\n${n.changeNote}` : null,
    n.decidedByEmail ? `승인: ${n.decidedByEmail}` : null,
  ].filter(Boolean) as string[];

  return [
    {
      type: "header",
      text: { type: "plain_text", text: `📢 문서 발행됨 · v${n.version}`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${n.documentTitle}* (v${n.version}) 가 발행되었습니다.` },
    },
    ...(lines.length
      ? [{ type: "section" as const, text: { type: "mrkdwn" as const, text: lines.join("\n") } }]
      : []),
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "발행 승인 보기", emoji: true },
          url: n.approvalUrl,
          style: "primary",
        },
      ],
    },
  ];
}

export type SlackSendResult =
  | { status: "sent"; ts: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export async function sendSlack(args: {
  channel: string | null;
  text: string;
  blocks: KnownBlock[];
}): Promise<SlackSendResult> {
  const c = client();
  if (!c) return { status: "skipped", reason: "SLACK_BOT_TOKEN not configured" };
  if (!args.channel) return { status: "skipped", reason: "no channel resolved" };
  try {
    const res = await c.chat.postMessage({
      channel: args.channel,
      text: args.text,
      blocks: args.blocks,
    });
    return { status: "sent", ts: String(res.ts ?? "") };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
