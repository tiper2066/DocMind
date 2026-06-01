"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UrlInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed.length === 0) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/kb/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        setUrl("");
        toast.success("URL 등록 완료, 크롤링을 시작합니다");
        router.refresh();
      } catch (err) {
        toast.error(`등록 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://pentasecurity.com/products/wapples"
        disabled={pending}
        autoComplete="off"
      />
      <Button type="submit" disabled={pending || url.trim().length === 0}>
        {pending ? "등록 중..." : "URL 등록"}
      </Button>
    </form>
  );
}
