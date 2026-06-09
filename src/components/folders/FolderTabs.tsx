"use client";

import type { ReactNode } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Folder } from "@/lib/folders/store";

// 문서함(폴더) 탭의 단일 출처. 문서함·에이전트·KB 가 공유한다.
// 활성=짙은 채움(foreground)·반전 글자, 비활성=hairline 보더, 하단 full-width hairline.
export function FolderTabs({
  folders,
  value,
  defaultValue,
  onValueChange,
  children,
}: {
  folders: Folder[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <Tabs value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
      <TabsList variant="folder">
        {folders.map((f) => (
          <TabsTrigger key={f.id} value={f.id}>
            {f.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
