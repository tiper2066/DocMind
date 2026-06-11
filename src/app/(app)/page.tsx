import { ArrowUp } from 'lucide-react';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Card } from '@/components/ui/card';
import { db } from '@/db/client';
import { agents, agentRuns, approvals, documents } from '@/db/schema';
import { getWorkspaceContext } from '@/lib/rbac';
import { canUseApprovalActions } from '@/lib/trend-admin';
import {
    PublishAllBar,
    type PendingItem,
} from '@/components/home/PublishAllBar';
import { TypeCards } from '@/components/home/TypeCards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getPendingApprovals(): Promise<PendingItem[]> {
    const ctx = await getWorkspaceContext();
    if (!ctx) return [];
    const rows = await db
        .select({
            id: approvals.id,
            payload: approvals.payload,
            docTitle: documents.title,
        })
        .from(approvals)
        .innerJoin(agentRuns, eq(agentRuns.id, approvals.runId))
        .innerJoin(agents, eq(agents.id, agentRuns.agentId))
        .leftJoin(documents, eq(documents.id, approvals.documentId))
        .where(
            and(eq(agents.workspaceId, ctx.workspaceId), isNull(approvals.decision)),
        )
        .orderBy(desc(approvals.createdAt));
    return rows.map((r) => ({
        id: r.id,
        title: r.docTitle ?? '문서',
        version: (r.payload as { version?: number } | null)?.version ?? null,
    }));
}

export default async function HomePage() {
    const pending = await getPendingApprovals();
    // 데모 보호: 화이트리스트 외 사용자는 전체 발행 승인 비활성 (서버 403 과 한 쌍).
    const ctx = await getWorkspaceContext();
    const actionsAllowed = ctx ? await canUseApprovalActions(ctx.userId) : false;
    return (
        <main className='mx-auto max-w-6xl px-6 py-8 pb-28'>
            <div className='mb-12 flex flex-col gap-3'>
                <h1 className='font-heading text-heading-2 text-ink'>
                    어떤 문서를 만들까요?
                </h1>
                <p className='text-subtitle text-steel'>
                    유형을 선택하면 질문이 시작됩니다.
                </p>
            </div>
            <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
                <TypeCards />
            </div>

            <Card
                title='프로덕션 버전에서 제공될 예정입니다'
                className='mt-5 border border-hairline bg-white p-6 ring-0'
            >
                <h3 className='font-heading text-heading-5 text-brand-navy'>
                    어떤 문서를 만들까요?
                </h3>
                <div className='relative'>
                    <textarea
                        placeholder='문서의 목적, 사용 처, 주요 내용을 자유롭게 입력해 주세요.'
                        className='min-h-32 w-full resize-none rounded-lg border border-hairline bg-page p-3 pr-14 text-sm text-ink placeholder:text-stone focus:ring-2 focus:ring-brand/30 focus:outline-none'
                    />
                    <button
                        type='button'
                        aria-label='맞춤 문서 생성'
                        className='absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-md bg-brand text-on-primary transition-colors hover:bg-brand-pressed'
                    >
                        <ArrowUp className='size-4' />
                    </button>
                </div>
            </Card>

            <PublishAllBar items={pending} canAct={actionsAllowed} />
        </main>
    );
}
