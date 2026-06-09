"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DocTitleEditor({
  docId,
  title,
}: {
  docId: string;
  title: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [pending, startTransition] = useTransition();

  const cancel = () => {
    setValue(title);
    setEditing(false);
  };

  const save = () => {
    const next = value.trim();
    if (next.length === 0 || next === title) {
      cancel();
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: next }),
        });
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);
        toast.success("제목을 변경했습니다.");
        setEditing(false);
        router.refresh();
      } catch (err) {
        toast.error(`제목 변경 실패: ${(err as Error).message}`);
      }
    });
  };

  if (!editing) {
    return (
      <div className="group flex items-center gap-2">
        <h1 className="font-heading text-heading-3 text-ink">{title}</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="제목 편집"
          className="text-stone opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            cancel();
          }
        }}
        className="font-heading text-heading-3 text-ink h-auto py-1"
        maxLength={200}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="저장"
        disabled={pending}
        onClick={save}
      >
        <Check />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="취소"
        disabled={pending}
        onClick={cancel}
      >
        <X />
      </Button>
    </div>
  );
}
