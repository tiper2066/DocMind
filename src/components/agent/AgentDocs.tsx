'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FolderTabs } from '@/components/folders/FolderTabs';
import { subscribeAgentEvents, type AgentEventMessage } from '@/lib/sse';
import { useFolders } from '@/lib/folders/store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ActivityFeed } from './ActivityFeed';
import { ApprovalActions, type ApproveResult } from './ApprovalActions';

const MAX_PER_RUN = 120;

// 단계 연출(replay) 중에는 SSE 기반 자동 새로고침을 보류 — 연출이 끝나면
// PendingCard 가 직접 refresh 한다.
const replayLock = { count: 0 };

// 이 타입의 이벤트가 도착하면 서버 렌더 영역(카드 목록·우측 통계)도 갱신할 가치가
// 있다 — 디바운스 후 router.refresh().
const REFRESH_EVENT_TYPES = new Set([
    'approval.requested',
    'source.acted',
    'source.learned',
    'approval.decided',
]);

export type DocVersion = {
    id: string;
    version: number;
    status: string;
    pending: { approvalId: string; runId: string } | null;
    runId: string | null;
    dateLabel: string;
};

export type DocGroup = {
    documentId: string;
    title: string;
    versions: DocVersion[];
};

export function AgentDocs({
    documents,
    initialEventsByRun,
    highlightApprovalId,
    actionsAllowed = true,
}: {
    documents: DocGroup[];
    initialEventsByRun: Record<string, AgentEventMessage[]>;
    highlightApprovalId?: string | null;
    actionsAllowed?: boolean;
}) {
    const { folders, folderOfDoc } = useFolders();
    const router = useRouter();
    const [eventsByRun, setEventsByRun] =
        useState<Record<string, AgentEventMessage[]>>(initialEventsByRun);
    const seen = useRef<Set<string>>(
        new Set(
            Object.values(initialEventsByRun)
                .flat()
                .map((e) => e.id),
        ),
    );
    const refreshTimer = useRef<number | null>(null);

    // SSE 단일 구독. 들어오는 이벤트를 runId 슬라이스에 누적(데모 B 라이브 유지).
    // 진행 상태가 바뀌는 이벤트면 서버 렌더 영역도 자동 갱신(디바운스 1.5s).
    useEffect(() => {
        const unsub = subscribeAgentEvents((m) => {
            if (seen.current.has(m.id)) return;
            seen.current.add(m.id);
            setEventsByRun((prev) => {
                const arr = prev[m.runId] ?? [];
                return { ...prev, [m.runId]: [...arr, m].slice(-MAX_PER_RUN) };
            });
            if (REFRESH_EVENT_TYPES.has(m.type)) {
                if (refreshTimer.current)
                    window.clearTimeout(refreshTimer.current);
                refreshTimer.current = window.setTimeout(() => {
                    if (replayLock.count === 0) router.refresh();
                }, 1500);
            }
        });
        return () => {
            unsub();
            if (refreshTimer.current)
                window.clearTimeout(refreshTimer.current);
        };
    }, [router]);

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
                                            canAct={actionsAllowed}
                                        />
                                    ) : (
                                        <HistoryCard
                                            key={v.id}
                                            title={doc.title}
                                            version={v.version}
                                            status={v.status}
                                            dateLabel={v.dateLabel}
                                            events={
                                                v.runId
                                                    ? eventsByRun[v.runId]
                                                    : undefined
                                            }
                                        />
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

// 발행 대기 카드의 단계 연출: 대기 중에는 "감지" 이벤트만 보여주고, 발행 승인 시
// 나머지 단계(인식→판단→행동→학습)를 시간차로 차례 공개해 진행 피드백을 준다.
// 해당 단계의 실제 이벤트가 없으면(감지만 기록된 시드 run) 대표 라인을 합성한다.
const REPLAY_PHASES = ['perceive', 'reason', 'act', 'learn'] as const;
const REPLAY_TYPES: Record<string, string> = {
    perceive: 'source.perceived',
    reason: 'source.impact-ready',
    act: 'source.acted',
    learn: 'source.learned',
};
const REPLAY_STEP_MS = 1400;

function PendingCard({
    title,
    version,
    approvalId,
    events,
    highlighted,
    canAct = true,
}: {
    title: string;
    version: number;
    approvalId: string;
    events: AgentEventMessage[] | undefined;
    highlighted: boolean;
    canAct?: boolean;
}) {
    const router = useRouter();
    const [revealCount, setRevealCount] = useState(0);
    const [replaying, setReplaying] = useState(false);
    const timer = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timer.current) window.clearInterval(timer.current);
        };
    }, []);

    const startReplay = (body: ApproveResult) => {
        setReplaying(true);
        replayLock.count += 1;
        let i = 0;
        timer.current = window.setInterval(() => {
            i += 1;
            setRevealCount(i);
            if (i >= REPLAY_PHASES.length) {
                if (timer.current) window.clearInterval(timer.current);
                window.setTimeout(() => {
                    const slack = body?.notify?.slack;
                    if (slack === 'sent') {
                        toast.success('발행 완료 · Slack 알림 발송 완료');
                    } else if (slack === 'failed') {
                        toast.warning('발행 완료 — Slack 발송 실패, 수동 공유 필요');
                    } else {
                        toast.success('발행 완료');
                    }
                    replayLock.count = Math.max(0, replayLock.count - 1);
                    router.refresh();
                }, REPLAY_STEP_MS);
            }
        }, REPLAY_STEP_MS);
    };

    const visible = useMemo(() => {
        const all = events ?? [];
        const out: AgentEventMessage[] = all.filter(
            (e) => e.phase === 'detect',
        );
        for (const ph of REPLAY_PHASES.slice(0, revealCount)) {
            const real = all.filter((e) => e.phase === ph);
            if (real.length > 0) {
                out.push(...real);
            } else {
                out.push({
                    id: `replay-${approvalId}-${ph}`,
                    runId: '',
                    phase: ph,
                    type: REPLAY_TYPES[ph],
                    ts: new Date().toISOString(),
                    payload: null,
                });
            }
        }
        return out;
    }, [events, revealCount, approvalId]);

    const feed = useMemo(() => [...visible].reverse(), [visible]);

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
                <div className='max-h-72 overflow-y-auto'>
                    <ActivityFeed events={feed} />
                </div>

                <div className='mt-4 flex items-center justify-end'>
                    {replaying ? (
                        <span className='text-xs text-muted-foreground'>
                            인식→판단→행동→학습 진행 중…
                        </span>
                    ) : (
                        <ApprovalActions
                            approvalId={approvalId}
                            onApproved={startReplay}
                            canAct={canAct}
                        />
                    )}
                </div>
            </div>
        </details>
    );
}

// 발행/거부된 버전 카드 — 타이틀바 클릭으로 펼침(기본 닫힘), 생성 run 의 활동 피드 표시.
// 인터뷰로 직접 생성된 버전(run 없음)은 안내 문구를 보여준다 (모든 카드 동작 일관).
function HistoryCard({
    title,
    version,
    status,
    dateLabel,
    events,
}: {
    title: string;
    version: number;
    status: string;
    dateLabel: string;
    events: AgentEventMessage[] | undefined;
}) {
    const feed = useMemo(() => [...(events ?? [])].reverse(), [events]);
    return (
        <details className='overflow-hidden rounded-xl border border-hairline bg-canvas'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4'>
                <span className='font-heading text-heading-5 text-ink'>
                    {title} v.{version}
                </span>
                <div className='flex items-center gap-2.5'>
                    <span className='text-xs text-muted-foreground'>
                        {dateLabel}
                    </span>
                    <StatusBadge status={status} />
                </div>
            </summary>
            <div className='border-t border-hairline px-5 py-4'>
                {feed.length > 0 ? (
                    <div className='max-h-72 overflow-y-auto'>
                        <ActivityFeed events={feed} />
                    </div>
                ) : (
                    <p className='rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground'>
                        이 버전은 인터뷰로 직접 생성되어 에이전트 활동 기록이
                        없습니다.
                    </p>
                )}
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
