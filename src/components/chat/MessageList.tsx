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
    <div className="flex flex-col gap-5 py-6">
      {turns.map((t, i) => (
        <Bubble key={i} role={t.role} text={t.text} />
      ))}
      {pending && <TypingBubble />}
      <div ref={endRef} />
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-muted px-4 py-3 text-foreground">
        <span className="flex items-center gap-1" aria-label="입력 중">
          {[0, 200, 400].map((delay) => (
            <span
              key={delay}
              className="inline-block size-1.5 animate-dot-bounce rounded-full bg-current opacity-50"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
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
