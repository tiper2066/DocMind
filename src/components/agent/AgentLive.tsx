"use client";

import { useEffect, useRef, useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { subscribeAgentEvents, type AgentEventMessage } from "@/lib/sse";
import { ActivityFeed } from "./ActivityFeed";
import { LoopDiagram } from "./LoopDiagram";

const MAX_EVENTS = 120;
const TERMINAL = new Set(["source.learned", "approval.decided"]);

export type VersionCard = {
  id: string;
  documentTitle: string;
  version: number;
  status: string;
  createdAt: string;
};

function activePhaseFrom(events: AgentEventMessage[]): string | null {
  const latest = events[0];
  if (!latest) return null;
  if (TERMINAL.has(latest.type) || latest.type.endsWith("failed")) return null;
  return latest.phase;
}

export function AgentLive({
  initialEvents,
  versions,
}: {
  initialEvents: AgentEventMessage[];
  versions: VersionCard[];
}) {
  const [events, setEvents] = useState<AgentEventMessage[]>(() =>
    [...initialEvents].reverse(),
  );
  const seen = useRef<Set<string>>(new Set(initialEvents.map((e) => e.id)));

  useEffect(() => {
    const unsub = subscribeAgentEvents((m) => {
      if (seen.current.has(m.id)) return;
      seen.current.add(m.id);
      setEvents((prev) => [m, ...prev].slice(0, MAX_EVENTS));
    });
    return unsub;
  }, []);

  const activePhase = activePhaseFrom(events);

  return (
    <Tabs defaultValue="feed">
      <TabsList>
        <TabsTrigger value="feed">활동 피드</TabsTrigger>
        <TabsTrigger value="loop">루프 구조</TabsTrigger>
        <TabsTrigger value="docs">생성된 문서</TabsTrigger>
      </TabsList>

      <TabsContent value="feed" className="mt-4">
        <ActivityFeed events={events} />
      </TabsContent>

      <TabsContent value="loop" className="mt-4">
        <div className="rounded-lg border p-6">
          <LoopDiagram activePhase={activePhase} />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {activePhase ? "진행 중" : "대기"}
          </p>
        </div>
      </TabsContent>

      <TabsContent value="docs" className="mt-4">
        {versions.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            생성된 문서가 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {v.documentTitle}{" "}
                  <span className="text-muted-foreground">v{v.version}</span>
                </span>
                <Badge
                  variant={
                    v.status === "published"
                      ? "secondary"
                      : v.status === "rejected"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {v.status === "published"
                    ? "발행됨"
                    : v.status === "rejected"
                      ? "거부됨"
                      : "대기"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
