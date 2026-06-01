"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

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

export function DocActions({
  docId,
  title,
  redirectTo,
}: {
  docId: string;
  title: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: "DELETE",
        });
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(
            b.error === "pending_approval"
              ? "진행 중인 승인이 있어 삭제할 수 없습니다. 먼저 승인/거부하세요."
              : (b.error ?? `HTTP ${res.status}`),
          );
        }
        toast.success("문서를 삭제했습니다.");
        setOpen(false);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } catch (err) {
        toast.error(`삭제 실패: ${(err as Error).message}`);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="문서 삭제"
            className="text-stone hover:bg-error/10 hover:text-error"
          />
        }
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>문서를 삭제할까요?</DialogTitle>
          <DialogDescription>
            “{title}” 과(와) 모든 버전·인터뷰 기록이 영구 삭제됩니다. 되돌릴 수
            없습니다.
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
  );
}
