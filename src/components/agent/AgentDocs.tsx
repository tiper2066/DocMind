'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FolderTabs } from '@/components/folders/FolderTabs';
import { subscribeAgentEvents, type AgentEventMessage } from '@/lib/sse';
import { useFolders } from '@/lib/folders/store';
import { ActivityFeed } from './ActivityFeed';
import { LoopDiagram } from './LoopDiagram';
import { ApprovalActions } from './ApprovalActions';

const MAX_PER_RUN = 120;
const TERMINAL = new Set(['source.learned', 'approval.decided']);

export type DocVersion = {
    id: string;
    version: number;
    status: string;
    pending: { approvalId: string; runId: string } | null;
    dateLabel: string;
};

export type DocGroup = {
    documentId: string;
    title: string;
    versions: DocVersion[];
};

function activePhaseOf(arr: AgentEventMessage[] | undefined): string | null {
    if (!arr || arr.length === 0) return null;
    const latest = arr[arr.length - 1];
    if (TERMINAL.has(latest.type) || latest.type.endsWith('failed'))
        return null;
    return latest.phase;
}

export function AgentDocs({
    documents,
    initialEventsByRun,
    highlightApprovalId,
}: {
    documents: DocGroup[];
    initialEventsByRun: Record<string, AgentEventMessage[]>;
    highlightApprovalId?: string | null;
}) {
    const { folders, folderOfDoc } = useFolders();
    const [eventsByRun, setEventsByRun] =
        useState<Record<string, AgentEventMessage[]>>(initialEventsByRun);
    const seen = useRef<Set<string>>(
        new Set(
            Object.values(initialEventsByRun)
                .flat()
                .map((e) => e.id),
        ),
    );

    // SSE 단일 구독. 들어오는 이벤트를 runId 슬라이스에 누적(데모 B 라이브 유지).
    useEffect(() => {
        const unsub = subscribeAgentEvents((m) => {
            if (seen.current.has(m.id)) return;
            seen.current.add(m.id);
            setEventsByRun((prev) => {
                const arr = prev[m.runId] ?? [];
                return { ...prev, [m.runId]: [...arr, m].slice(-MAX_PER_RUN) };
            });
        });
        return unsub;
    }, []);

    // 문서함(폴더) → 소속 문서 그룹. 매핑 없는 실문서는 시드 문서함으로 귀속.
    const docsByFolder = useMemo(() => {
        const map = new Map<string, DocGroup[]>();
        for (const f of folders) map.set(f.id, []);
        for (const d of documents) {
            const fid = folderOfDoc(d.documentId);
            (map.get(fid) ?? map.set(fid, []).get(fid)!).push(d);
        }
        return map;
    }, [documents, folders, folderOfDoc]);

    // 기본 탭: 딥링크 승인 → 대기 보유 → 문서 보유 → 첫 문서함.
    const defaultTab = useMemo(() => {
        const hasPending = (g: DocGroup) => g.versions.some((v) => v.pending);
        const hasHighlight = (g: DocGroup) =>
            g.versions.some(
                (v) => v.pending?.approvalId === highlightApprovalId,
            );
        const pick = (test: (g: DocGroup) => boolean) =>
            folders.find((f) => (docsByFolder.get(f.id) ?? []).some(test))?.id;
        if (highlightApprovalId) {
            const h = pick(hasHighlight);
            if (h) return h;
        }
        return (
            pick(hasPending) ??
            folders.find((f) => (docsByFolder.get(f.id) ?? []).length > 0)?.id ??
            folders[0]?.id ??
            ''
        );
    }, [folders, docsByFolder, highlightApprovalId]);

    if (folders.length === 0) {
        return (
            <p className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
                문서함이 없습니다.
            </p>
        );
    }

    return (
        <FolderTabs folders={folders} defaultValue={defaultTab}>
            {folders.map((f) => {
                const groups = docsByFolder.get(f.id) ?? [];
                return (
                    <TabsContent
                        key={f.id}
                        value={f.id}
                        className='mt-4 space-y-3'
                    >
                        {groups.length === 0 ? (
                            <p className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
                                이 문서함에 문서가 없습니다.
                            </p>
                        ) : (
                            groups.flatMap((doc) =>
                                doc.versions.map((v) =>
                                    v.pending ? (
                                        <PendingCard
                                            key={v.id}
                                            title={doc.title}
                                            version={v.version}
                                            approvalId={v.pending.approvalId}
                                            events={
                                                eventsByRun[v.pending.runId]
                                            }
                                            highlighted={
                                                v.pending.approvalId ===
                                                highlightApprovalId
                                            }
                                        />
                                    ) : (
                                        <div
                                            key={v.id}
                                            className='flex items-center justify-between gap-2 rounded-xl border border-hairline bg-canvas px-5 py-4'
                                        >
                                            <span className='font-heading text-heading-5 text-ink'>
                                                {doc.title} v.{v.version}
                                            </span>
                                            <div className='flex items-center gap-2.5'>
                                                <span className='text-xs text-muted-foreground'>
                                                    {v.dateLabel}
                                                </span>
                                                <StatusBadge status={v.status} />
                                            </div>
                                        </div>
                                    ),
                                ),
                            )
                        )}
                    </TabsContent>
                );
            })}
        </FolderTabs>
    );
}

function PendingCard({
    title,
    version,
    approvalId,
    events,
    highlighted,
}: {
    title: string;
    version: number;
    approvalId: string;
    events: AgentEventMessage[] | undefined;
    highlighted: boolean;
}) {
    const phase = activePhaseOf(events);
    const feed = useMemo(() => [...(events ?? [])].reverse(), [events]);

    return (
        <details
            open
            className={`overflow-hidden rounded-xl border bg-canvas ${
                highlighted
                    ? 'border-primary ring-2 ring-primary/40'
                    : 'border-hairline'
            }`}
        >
            <summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4'>
                <span className='font-heading text-heading-5 text-ink'>
                    {title} v.{version}
                </span>
                <StatusBadge status='pending' />
            </summary>

            <div className='border-t border-hairline px-5 py-4'>
                <Tabs defaultValue='feed'>
                    <TabsList>
                        <TabsTrigger value='feed'>활동 피드</TabsTrigger>
                        <TabsTrigger value='loop'>루프 구조</TabsTrigger>
                    </TabsList>
                    <TabsContent
                        value='feed'
                        className='mt-3 max-h-72 overflow-y-auto'
                    >
                        <ActivityFeed events={feed} />
                    </TabsContent>
                    <TabsContent value='loop' className='mt-3'>
                        <div className='rounded-lg border p-6'>
                            <LoopDiagram activePhase={phase} />
                            <p className='mt-2 text-center text-xs text-muted-foreground'>
                                {phase ? '진행 중' : '대기'}
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className='mt-4 flex justify-end'>
                    <ApprovalActions approvalId={approvalId} />
                </div>
            </div>
        </details>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'published') {
        return (
            <Badge
                variant='outline'
                className='border-transparent bg-tint-sky text-link-blue'
            >
                발행
            </Badge>
        );
    }
    if (status === 'rejected') {
        return <Badge variant='destructive'>거부됨</Badge>;
    }
    return (
        <Badge
            variant='outline'
            className='border-transparent bg-tint-mint text-brand-green'
        >
            대기
        </Badge>
    );
}
