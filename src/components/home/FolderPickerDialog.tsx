"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFolders } from "@/lib/folders/store";

export function FolderPickerDialog({
  type,
  open,
  onOpenChange,
}: {
  type: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { folders, addFolder } = useFolders();
  const [newName, setNewName] = useState("");

  const proceed = (folderId: string) => {
    if (!type) return;
    onOpenChange(false);
    setNewName("");
    router.push(
      `/chat/new?type=${encodeURIComponent(type)}&folder=${encodeURIComponent(folderId)}`,
    );
  };

  const createAndProceed = () => {
    const name = newName.trim();
    if (!name) return;
    const folder = addFolder(name);
    proceed(folder.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>문서를 어디에 만들까요?</DialogTitle>
          <DialogDescription>
            새 문서함 생성 또는 기존 문서함을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => proceed(f.id)}
              className={cn(
                "rounded-lg border border-hairline bg-canvas px-4 py-2 text-body-sm font-medium text-ink transition-colors",
                "hover:border-brand hover:text-brand",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2 border-t border-hairline pt-4">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              // 한글 IME 조합 확정 Enter 는 무시 (마지막 글자로 빈 문서함이 생기는 것 방지).
              if (e.key === "Enter" && !e.nativeEvent.isComposing)
                createAndProceed();
            }}
            placeholder="새 문서함 이름"
            className="flex-1"
          />
          <Button onClick={createAndProceed} disabled={!newName.trim()}>
            새 문서함 만들기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
