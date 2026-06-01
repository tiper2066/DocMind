import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM ?? "DocMind <onboarding@resend.dev>";

const globalForResend = globalThis as unknown as { resendClient?: Resend };

function client(): Resend | null {
  if (!apiKey || apiKey.startsWith("re_xxxx")) return null; // 미설정/placeholder
  const c = globalForResend.resendClient ?? new Resend(apiKey);
  if (process.env.NODE_ENV !== "production") globalForResend.resendClient = c;
  return c;
}

export function isEmailConfigured(): boolean {
  return client() !== null;
}

export type EmailSendResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export type PublishEmail = {
  to: string[];
  documentTitle: string;
  version: number;
  changeNote?: string | null;
  url: string;
};

function renderHtml(e: PublishEmail): string {
  const note = e.changeNote
    ? `<p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(e.changeNote)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f6f7;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #ececec;border-radius:12px;padding:28px">
    <p style="font-size:13px;color:#888;margin:0 0 8px">DocMind Agent</p>
    <h1 style="font-size:18px;margin:0 0 12px">문서가 발행되었습니다 · v${e.version}</h1>
    <p style="font-size:15px;margin:0 0 16px"><strong>${escapeHtml(e.documentTitle)}</strong> (v${e.version})</p>
    ${note}
    <a href="${e.url}" style="display:inline-block;background:#5b5bd6;color:#fff;text-decoration:none;font-size:14px;padding:10px 18px;border-radius:8px">대시보드에서 보기</a>
  </div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendPublishEmail(e: PublishEmail): Promise<EmailSendResult> {
  const c = client();
  if (!c) return { status: "skipped", reason: "RESEND_API_KEY not configured" };
  if (e.to.length === 0) return { status: "skipped", reason: "no recipients" };
  try {
    const res = await c.emails.send({
      from: FROM,
      to: e.to,
      subject: `[DocMind] ${e.documentTitle} v${e.version} 발행`,
      html: renderHtml(e),
    });
    if (res.error) return { status: "failed", error: res.error.message };
    return { status: "sent", id: res.data?.id ?? "" };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
