"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Folder } from "@/lib/folders/store";

const FADE_PX = 28;
const EDGE_EPSILON = 2;

// 탭이 화면 폭을 넘으면 탭 영역만 가로 스크롤(모바일 터치 드래그)되도록 하고,
// "그쪽에 더 있음" 방향에만 가장자리 페이드 마스크를 동적으로 표시한다.
function useEdgeMask() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > EDGE_EPSILON;
      const right =
        el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_EPSILON;
      setEdges((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right },
      );
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return { ref, edges };
}

function maskImage(edges: {
  left: boolean;
  right: boolean;
}): string | undefined {
  if (edges.left && edges.right) {
    return `linear-gradient(to right, transparent, black ${FADE_PX}px, black calc(100% - ${FADE_PX}px), transparent)`;
  }
  if (edges.left) {
    return `linear-gradient(to right, transparent, black ${FADE_PX}px)`;
  }
  if (edges.right) {
    return `linear-gradient(to right, black calc(100% - ${FADE_PX}px), transparent)`;
  }
  return undefined;
}

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
  const { ref, edges } = useEdgeMask();
  const active = value ?? defaultValue;

  // 진입/탭 변경 시 활성 탭이 스크롤 밖이면 보이는 위치로 (페이지 세로 스크롤은 안 건드림).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const trigger = el.querySelector<HTMLElement>('[data-state="active"]');
    if (!trigger) return;
    const left = trigger.offsetLeft;
    const right = left + trigger.offsetWidth;
    if (left < el.scrollLeft) {
      el.scrollLeft = Math.max(0, left - FADE_PX);
    } else if (right > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = right - el.clientWidth + FADE_PX;
    }
  }, [ref, active]);

  const mask = maskImage(edges);

  return (
    <Tabs value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
      <div
        ref={ref}
        className="scrollbar-none overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        <TabsList variant="folder" className="min-w-max">
          {folders.map((f) => (
            <TabsTrigger key={f.id} value={f.id}>
              {f.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
