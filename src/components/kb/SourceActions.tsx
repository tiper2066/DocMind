"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SourceActions({
  sourceId,
  title,
  kind,
}: {
  sourceId: string;
  title: string;
  kind: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [editing, startEdit] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const remove = () =>
    startTransition(async () => {
      try {
        const res = await fetch(`/api/kb/sources/${sourceId}`, {
          method: "DELETE",
        });
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);
        toast.success("소스를 삭제했습니다.");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(`삭제 실패: ${(err as Error).message}`);
      }
    });

  // 파일 소스: 새 파일 업로드(sign→PUT) 후 PATCH 로 교체 + 변경 감지 트리거.
  const replaceFile = (file: File) =>
    startEdit(async () => {
      try {
        const signRes = await fetch("/api/kb/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        const sign = (await signRes.json().catch(() => ({}))) as {
          key?: string;
          signedUrl?: string;
          error?: string;
        };
        if (!signRes.ok || !sign.key || !sign.signedUrl) {
          throw new Error(sign.error ?? `sign HTTP ${signRes.status}`);
        }
        const putRes = await fetch(sign.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) throw new Error(`upload HTTP ${putRes.status}`);

        const res = await fetch(`/api/kb/sources/${sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: sign.key }),
        });
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);
        toast.success("자료를 교체했습니다. 변경 감지를 시작합니다.");
        router.refresh();
      } catch (err) {
        toast.error(`수정 실패: ${(err as Error).message}`);
      }
    });

  // URL 소스: 외부 페이지 변경 재감지 트리거.
  const reDetect = () =>
    startEdit(async () => {
      try {
        const res = await fetch(`/api/kb/sources/${sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);
        toast.success("변경 감지를 시작했습니다.");
        router.refresh();
      } catch (err) {
        toast.error(`재감지 실패: ${(err as Error).message}`);
      }
    });

  return (
    <div className="flex items-center gap-1">
      {kind === "file" ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.pptx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) replaceFile(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="자료 교체 (수정)"
            disabled={editing}
            className="bg-canvas text-stone hover:bg-brand/10 hover:text-brand"
            onClick={() => fileRef.current?.click()}
          >
            <Pencil />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="변경 재감지 (수정)"
          disabled={editing}
          className="bg-canvas text-stone hover:bg-brand/10 hover:text-brand"
          onClick={reDetect}
        >
          <RefreshCw className={editing ? "animate-spin" : undefined} />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="소스 삭제"
              className="bg-canvas text-stone hover:bg-error/10 hover:text-error"
            />
          }
        >
          <Trash2 />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>소스를 삭제할까요?</DialogTitle>
            <DialogDescription>
              “{title}” 과(와) 학습된 청크가 영구 삭제됩니다. 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">취소</Button>} />
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
