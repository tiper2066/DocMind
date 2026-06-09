"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFolders } from "@/lib/folders/store";

// 세션 한정 문서함 추가. 생성 후 onCreated 로 새 문서함 id 를 알려 탭 자동 전환을 맡긴다.
export function NewFolderButton({
  onCreated,
}: {
  onCreated?: (folderId: string) => void;
}) {
  const { addFolder } = useFolders();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const folder = addFolder(trimmed);
    onCreated?.(folder.id);
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>새 문서함 만들기</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>새 문서함 만들기</DialogTitle>
          <DialogDescription>
            현재 세션에서만 유지되는 문서함을 추가합니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:items-center sm:justify-start sm:gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // 한글 IME 조합 중 Enter(조합 확정)는 무시 — 조합 확정과 제출이 겹쳐
              // 마지막 글자("서")로 폴더가 하나 더 생성되던 버그 방지.
              if (e.key === "Enter" && !e.nativeEvent.isComposing) create();
            }}
            placeholder="새 문서함 이름"
            className="flex-1"
          />
          <Button onClick={create} disabled={!name.trim()}>
            만들기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
