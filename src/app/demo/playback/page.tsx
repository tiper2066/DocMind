import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 라이브 데모 실패·네트워크 차단 시 재생할 백업 녹화본. mp4 를 public/demo/ 에 두면
// 자동으로 플레이어가 뜨고, 없으면 배치 안내를 보여준다(USB→public/demo/ 복사 후 새로고침).
const CLIPS = [
  {
    key: "demo-a",
    title: "Demo A — 인터뷰 → PPT 생성",
    desc: "5문답 인터뷰 후 30초 내 미리보기 + .pptx 다운로드",
    file: "demo-a.mp4",
  },
  {
    key: "demo-b",
    title: "Demo B — 자율 갱신 루프",
    desc: "소스 변경 감지 → 5단계 자동 진행 → 승인 → Slack 알림",
    file: "demo-b.mp4",
  },
];

export default function DemoPlaybackPage() {
  const publicDir = join(process.cwd(), "public", "demo");
  const clips = CLIPS.map((c) => ({
    ...c,
    exists: existsSync(join(publicDir, c.file)),
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-heading-3 text-ink">데모 백업 재생</h1>
          <p className="mt-1 text-body-sm text-steel">
            라이브 시연이 막히면 이 페이지의 녹화본으로 대체한다.
          </p>
        </div>
        <Link href="/" className="text-body-sm text-link-blue hover:underline">
          ← 홈으로
        </Link>
      </div>

      <div className="flex flex-col gap-8">
        {clips.map((c) => (
          <section
            key={c.key}
            className="rounded-xl border bg-card p-5"
          >
            <h2 className="font-heading text-heading-5 text-ink">{c.title}</h2>
            <p className="mt-1 mb-4 text-body-sm text-steel">{c.desc}</p>
            {c.exists ? (
              <video
                controls
                preload="metadata"
                className="aspect-video w-full rounded-lg border bg-black"
              >
                <source src={`/demo/${c.file}`} type="video/mp4" />
                브라우저가 video 태그를 지원하지 않습니다.
              </video>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed bg-surface-soft p-6 text-center">
                <p className="text-body-sm text-steel">
                  녹화본 없음. <code className="font-mono">public/demo/{c.file}</code>{" "}
                  에 mp4 를 두고 새로고침하세요.
                </p>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
