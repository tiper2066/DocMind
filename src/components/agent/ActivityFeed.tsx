import type { AgentEventMessage } from '@/lib/sse';
import { phaseLabel, phaseText } from './phases';

function shortType(type: string): string {
    return type.split('.').slice(-1)[0] ?? type;
}

export function ActivityFeed({ events }: { events: AgentEventMessage[] }) {
    if (events.length === 0) {
        return (
            <p className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
                아직 활동이 없습니다. &ldquo;지금 감지&rdquo;를 눌러보세요.
            </p>
        );
    }

    return (
        <ul className='space-y-1.5 p-1'>
            {events.map((e) => {
                const failed = e.type.endsWith('failed');
                return (
                    <li
                        key={e.id}
                        className='flex items-center gap-3 rounded-md bg-canvas px-3 py-2 text-sm ring-1 ring-hairline'
                    >
                        <span
                            className={`size-2 shrink-0 rounded-full bg-current ${failed ? 'text-destructive' : phaseText(e.phase)}`}
                            aria-hidden
                        />
                        <span
                            className={`w-10 shrink-0 font-medium ${phaseText(e.phase)}`}
                        >
                            {phaseLabel(e.phase)}
                        </span>
                        <span
                            className={
                                failed ? 'flex-1 text-destructive' : 'flex-1'
                            }
                        >
                            {shortType(e.type)}
                        </span>
                        <time
                            suppressHydrationWarning
                            className='shrink-0 text-xs text-muted-foreground'
                        >
                            {new Date(e.ts).toLocaleTimeString('ko-KR')}
                        </time>
                    </li>
                );
            })}
        </ul>
    );
}
