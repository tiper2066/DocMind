'use client';

import { type ReactNode, useState } from 'react';

import { FolderTabs } from '@/components/folders/FolderTabs';
import { DEFAULT_FOLDER_ID, useFolders } from '@/lib/folders/store';

// 표시 전용 문서함 탭. 기존 소스는 전부 시드 WAPPLES 문서함에 귀속(DEFAULT_FOLDER_ID),
// 그 외 문서함은 빈 탭. 소스↔문서함 매핑은 후순위라 데이터 분리는 하지 않는다.
export function KbFolderTabs({ children }: { children: ReactNode }) {
    const { folders } = useFolders();
    const [active, setActive] = useState(DEFAULT_FOLDER_ID);

    return (
        <FolderTabs folders={folders} value={active} onValueChange={setActive}>
            <div className='mt-2'>
                {active === DEFAULT_FOLDER_ID ? (
                    children
                ) : (
                    <p className='rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground'>
                        이 문서함에 등록된 소스가 없습니다.
                    </p>
                )}
            </div>
        </FolderTabs>
    );
}
