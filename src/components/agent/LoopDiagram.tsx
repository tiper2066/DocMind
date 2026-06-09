"use client";

import { PHASES, PHASE_INDEX } from "./phases";

// 5단계 루프 SVG. activePhase 노드는 펄스, 그 이전 단계는 완료(진하게), 이후는 흐리게.
export function LoopDiagram({ activePhase }: { activePhase: string | null }) {
  const activeIdx = activePhase != null ? (PHASE_INDEX[activePhase] ?? -1) : -1;
  const W = 520;
  const H = 96;
  const cy = 38;
  const step = W / PHASES.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="에이전트 5단계 루프"
    >
      {PHASES.map((p, i) => {
        if (i === PHASES.length - 1) return null;
        const x1 = step * (i + 0.5);
        const x2 = step * (i + 1.5);
        const done = i < activeIdx;
        return (
          <line
            key={`l-${p.key}`}
            x1={x1}
            y1={cy}
            x2={x2}
            y2={cy}
            strokeWidth={2}
            className={
              done
                ? "stroke-current text-foreground/40"
                : "stroke-current text-border"
            }
          />
        );
      })}
      {PHASES.map((p, i) => {
        const cx = step * (i + 0.5);
        const state =
          activeIdx < 0
            ? "idle"
            : i < activeIdx
              ? "done"
              : i === activeIdx
                ? "active"
                : "upcoming";
        const circleClass =
          state === "active"
            ? `fill-current ${p.text} animate-pulse`
            : state === "done"
              ? "fill-current text-foreground/60"
              : state === "upcoming"
                ? "fill-current text-muted-foreground/25"
                : "fill-current text-muted-foreground/40";
        const labelClass =
          state === "active"
            ? `fill-current ${p.text} font-semibold`
            : "fill-current text-muted-foreground";
        const r = state === "active" ? 13 : 10;
        return (
          <g key={p.key}>
            {/* 불투명 백드롭: 노드를 지나는 연결선이 반투명 상태색을 통해 비치지 않게 가린다. */}
            <circle cx={cx} cy={cy} r={r} className="fill-current text-canvas" />
            <circle cx={cx} cy={cy} r={r} className={circleClass} />
            <text
              x={cx}
              y={cy + 34}
              textAnchor="middle"
              className={labelClass}
              style={{ fontSize: 13 }}
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
