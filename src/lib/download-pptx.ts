// 클라이언트 .pptx 다운로드: 동일 출처 API 에서 바이트를 받아 blob 으로 저장.
// 서버가 X-Download-Filename(헤더, percent-encoded)으로 한글 파일명을 전달한다.
export async function triggerPptxDownload(versionId: string): Promise<void> {
  const res = await fetch(`/api/generate/${versionId}/pptx`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const name = decodeURIComponent(
    res.headers.get("X-Download-Filename") ?? "document.pptx",
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
