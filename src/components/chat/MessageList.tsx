"use client";

import { useEffect, useRef } from "react";
import type { ChatTurn } from "@/lib/interview/store";

export function MessageList({
  turns,
  pending,
}: {
  turns: ChatTurn[];
  pending: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending]);

  return (
    <div className="flex flex-col gap-3 py-4">
      {turns.map((t, i) => (
        <Bubble key={i} role={t.role} text={t.text} />
      ))}
      {pending && <Bubble role="ai" text="…" />}
      <div ref={endRef} />
    </div>
  );
}

function Bubble({ role, text }: { role: "ai" | "user"; text: string }) {
  const isUser = role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-foreground text-background"
            : "bg-muted text-foreground"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
