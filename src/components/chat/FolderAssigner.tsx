"use client";

import { useEffect } from "react";
import { useFolders } from "@/lib/folders/store";

// 세션 한정: 생성된 문서를 선택한 문서함에 귀속(데모용, 새로고침 시 소멸).
export function FolderAssigner({
  documentId,
  folder,
}: {
  documentId: string;
  folder: string;
}) {
  const { assignDoc } = useFolders();
  useEffect(() => {
    assignDoc(documentId, folder);
  }, [documentId, folder, assignDoc]);
  return null;
}
