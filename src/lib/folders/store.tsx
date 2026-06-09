"use client";

// 데모용 세션 문서함 스토어. DB 미사용(folders 테이블 후순위) — (app) 레이아웃에 마운트되어
// 클라 네비게이션 동안 유지되고 하드 리프레시 시 소멸한다. 문서↔문서함 매핑도 세션 한정.

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Folder = { id: string; name: string; seeded: boolean };

// 권장 1번: 기존 실문서는 이 시드 문서함 아래에 표시된다.
export const SEED_FOLDERS: Folder[] = [
  { id: "seed-wapples", name: "WAPPLES 제품소개서", seeded: true },
  { id: "seed-damo", name: "D.AMO 제품소개서", seeded: true },
];

export const DEFAULT_FOLDER_ID = SEED_FOLDERS[0].id;

type FolderStore = {
  folders: Folder[];
  docFolder: Record<string, string>; // documentId → folderId (세션 한정)
  addFolder: (name: string) => Folder;
  assignDoc: (documentId: string, folderId: string) => void;
  folderOfDoc: (documentId: string) => string;
};

const FolderContext = createContext<FolderStore | null>(null);

let counter = 0;

export function FolderStoreProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = useState<Folder[]>(SEED_FOLDERS);
  const [docFolder, setDocFolder] = useState<Record<string, string>>({});

  const addFolder = useCallback(
    (name: string): Folder => {
      const trimmed = name.trim();
      const existing = folders.find((f) => f.name === trimmed);
      if (existing) return existing;
      // Math.random/Date.now 회피 — 단조 증가 카운터로 세션 내 유일 id.
      counter += 1;
      const folder: Folder = { id: `session-${counter}`, name: trimmed, seeded: false };
      setFolders((prev) => [...prev, folder]);
      return folder;
    },
    [folders],
  );

  // idempotent — 이미 같은 매핑이면 prev 그대로 반환해 재렌더/루프를 막는다.
  const assignDoc = useCallback((documentId: string, folderId: string) => {
    setDocFolder((prev) =>
      prev[documentId] === folderId ? prev : { ...prev, [documentId]: folderId },
    );
  }, []);

  const folderOfDoc = useCallback(
    (documentId: string) => docFolder[documentId] ?? DEFAULT_FOLDER_ID,
    [docFolder],
  );

  const value = useMemo<FolderStore>(
    () => ({ folders, docFolder, addFolder, assignDoc, folderOfDoc }),
    [folders, docFolder, addFolder, assignDoc, folderOfDoc],
  );

  return <FolderContext value={value}>{children}</FolderContext>;
}

export function useFolders(): FolderStore {
  const ctx = useContext(FolderContext);
  if (!ctx) throw new Error("useFolders must be used within FolderStoreProvider");
  return ctx;
}
