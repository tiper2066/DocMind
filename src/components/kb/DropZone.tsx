"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
};

const MAX_BYTES = 25 * 1024 * 1024;

export function DropZone() {
  const router = useRouter();
  const [busy, setBusy] = useState<string[]>([]);

  const onDrop = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: 25MB 초과`);
          continue;
        }
        setBusy((b) => [...b, file.name]);
        try {
          await uploadOne(file);
          toast.success(`업로드 완료: ${file.name}`);
        } catch (err) {
          toast.error(`업로드 실패: ${file.name} — ${(err as Error).message}`);
        } finally {
          setBusy((b) => b.filter((n) => n !== file.name));
        }
      }
      router.refresh();
    },
    [router],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_BYTES,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition ${
        isDragActive
          ? "border-foreground/40 bg-muted/40"
          : "border-border hover:border-foreground/30"
      } cursor-pointer`}
    >
      <input {...getInputProps()} />
      <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm">
        {isDragActive
          ? "여기에 놓으세요"
          : "PDF · DOCX · XLSX · PPTX 파일을 드롭하거나 클릭해 선택"}
      </p>
      <p className="text-xs text-muted-foreground">최대 25MB</p>
      {busy.length > 0 && (
        <ul className="mt-3 w-full max-w-md space-y-1 text-left text-xs text-muted-foreground">
          {busy.map((n) => (
            <li key={n}>업로드 중: {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function uploadOne(file: File): Promise<void> {
  const signRes = await fetch("/api/kb/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name }),
  });
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({}));
    throw new Error(body?.error ?? `sign HTTP ${signRes.status}`);
  }
  const { key, signedUrl } = (await signRes.json()) as {
    key: string;
    signedUrl: string;
  };

  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!putRes.ok) throw new Error(`upload HTTP ${putRes.status}`);

  const finRes = await fetch("/api/kb/upload/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, filename: file.name }),
  });
  if (!finRes.ok) {
    const body = await finRes.json().catch(() => ({}));
    throw new Error(body?.error ?? `finalize HTTP ${finRes.status}`);
  }
}
