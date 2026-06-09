"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { FolderTabs } from "@/components/folders/FolderTabs";
import { DocActions } from "@/components/docs/DocActions";
import { NewFolderButton } from "@/components/docs/NewFolderButton";
import { useFolders } from "@/lib/folders/store";
import { cn } from "@/lib/utils";

export type DocCard = {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: string; // ISO
  latest: number | null;
  count: number;
  isNew: boolean;
  isUpdated: boolean;
};

export function DocsFolderView({
  docs,
  typeLabels,
}: {
  docs: DocCard[];
  typeLabels: Record<string, string>;
}) {
  const { folders, folderOfDoc } = useFolders();
  const typeFilters = [
    { key: "", label: "전체" },
    ...Object.entries(typeLabels).map(([key, label]) => ({ key, label })),
  ];

  const initialFolder =
    folders.find((f) => docs.some((d) => folderOfDoc(d.id) === f.id))?.id ??
    folders[0]?.id ??
    "";
  const [activeFolder, setActiveFolder] = useState(initialFolder);
  const [typeFilter, setTypeFilter] = useState("");

  const visible = useMemo(
    () =>
      docs.filter(
        (d) =>
          folderOfDoc(d.id) === activeFolder &&
          (typeFilter === "" || d.type === typeFilter),
      ),
    [docs, folderOfDoc, activeFolder, typeFilter],
  );

  return (
    <div className="space-y-4">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-heading-3 text-ink">문서함</h1>
          <p className="mt-1 text-body-sm text-steel">
            생성·갱신된 문서와 버전 이력을 확인합니다.
          </p>
        </div>
        <NewFolderButton onCreated={setActiveFolder} />
      </div>

      <FolderTabs
        folders={folders}
        value={activeFolder}
        onValueChange={setActiveFolder}
      />

      <div className="flex flex-wrap gap-1.5">
        {typeFilters.map((f) => (
          <button
            key={f.key || "all"}
            type="button"
            onClick={() => setTypeFilter(f.key)}
          >
            <Badge
              variant={typeFilter === f.key ? "default" : "outline"}
              className={cn(
                "h-auto px-3.5 py-1.5 text-sm",
                typeFilter !== f.key && "bg-canvas",
              )}
            >
              {f.label}
            </Badge>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          이 문서함에 문서가 없습니다.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((d) => (
            <li key={d.id} className="relative">
              <Link
                href={`/docs/${d.id}`}
                className="block rounded-lg bg-canvas p-4 pr-12 ring-1 ring-hairline transition duration-200 hover:-translate-y-0.5 hover:bg-surface hover:shadow-elevation-2"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary">
                    {typeLabels[d.type] ?? d.type}
                  </Badge>
                  <Badge variant={d.status === "ready" ? "outline" : "ghost"}>
                    {d.status === "ready" ? "완료" : "초안"}
                  </Badge>
                  {d.status === "ready" && d.isNew && (
                    <Badge variant="default">New</Badge>
                  )}
                  {d.status === "ready" && d.isUpdated && (
                    <Badge
                      variant="default"
                      className="border-transparent bg-ink-deep text-on-dark"
                    >
                      Update
                    </Badge>
                  )}
                </div>
                <div className="line-clamp-2 text-sm font-medium">{d.title}</div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {d.latest
                    ? `v${d.latest} · ${d.count}개 버전`
                    : "버전 없음"}{" "}
                  · {new Date(d.updatedAt).toLocaleDateString("ko-KR")}
                </div>
              </Link>
              <div className="absolute top-3 right-3 z-10">
                <DocActions docId={d.id} title={d.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
