"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInterviewStore,
  type InitialChatState,
} from "@/lib/interview/store";
import {
  DOC_TYPE_LABELS,
  isAnswerable,
  type AnswerableStep,
} from "@/lib/interview/machine";
import { MessageList } from "./MessageList";
import { QuickReplies } from "./QuickReplies";
import { ProgressTrack } from "./ProgressTrack";
import { InsightBox } from "./InsightBox";

const LENGTH_OPTIONS = [
  "10 ~ 12장 (표준)",
  "8 ~ 9장 (간결)",
  "13 ~ 15장 (상세)",
  "16장 이상 (풀버전)",
];
const LENGTH_ITEMS: Record<string, string> = Object.fromEntries(
  LENGTH_OPTIONS.map((o) => [o, o]),
);

const SECURITY_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Level 1 - Secret Permission Required" },
  { value: "2", label: "Level 2 - Confidential Internal Only" },
  { value: "3", label: "Level 3 - Confidential Subject to NDA" },
  { value: "4", label: "Level 4 - Confidential Subject to EULA" },
  { value: "5", label: "Level 5 - Public" },
];
const SECURITY_ITEMS: Record<string, string> = Object.fromEntries(
  SECURITY_OPTIONS.map((o) => [o.value, o.label]),
);

export function ChatView({ initial }: { initial: InitialChatState }) {
  const router = useRouter();
  const [useStore] = useState(() => createInterviewStore(initial));
  const state = useStore();

  const [input, setInput] = useState("");
  const [lengthChoice, setLengthChoice] = useState("");
  const [securityLevel, setSecurityLevel] = useState<1 | 2 | 3 | 4 | 5>(1);

  const typeLabel = useMemo(
    () => DOC_TYPE_LABELS[state.documentType] ?? state.documentType,
    [state.documentType],
  );

  const submit = async (raw: string) => {
    const answer = raw.trim();
    if (answer.length === 0) return;
    if (!isAnswerable(state.currentStep)) return;

    const step = state.currentStep as AnswerableStep;
    useStore.getState().pushUser(answer);
    useStore.getState().setPending(true);

    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: state.documentId,
          step,
          answer,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
        );
      }
      const data = body as {
        step: string;
        answers: Record<string, string>;
        question?: {
          aiMessage: string;
          quickReplies: string[];
          insight?: string;
          matches: Array<{
            sourceId: string;
            title: string | null;
            text: string;
            sim: number;
          }>;
        };
        done?: boolean;
      };
      useStore.getState().applyNext({
        step: data.step as AnswerableStep,
        answers: data.answers,
        aiMessage: data.question?.aiMessage,
        quickReplies: data.question?.quickReplies,
        insight: data.question?.insight,
        matches: data.question?.matches,
        done: Boolean(data.done),
      });
      setInput("");
    } catch (err) {
      toast.error(`응답 처리 실패: ${(err as Error).message}`);
    } finally {
      useStore.getState().setPending(false);
    }
  };

  const goto = async (step: AnswerableStep) => {
    if (useStore.getState().pending) return;
    useStore.getState().setPending(true);
    try {
      const res = await fetch("/api/interview/step", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: state.documentId, step }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
        );
      }
      const data = body as {
        step: string;
        answers: Record<string, string>;
        question?: {
          aiMessage: string;
          quickReplies: string[];
          insight?: string;
          matches: Array<{
            sourceId: string;
            title: string | null;
            text: string;
            sim: number;
          }>;
        };
        previousAnswer?: string;
      };
      if (!data.question) throw new Error("질문을 불러오지 못했습니다.");
      // 되돌아간 단계에서 사용자가 원래 봤던 질문을 그대로 복원(있으면). 서버 재생성본은
      // 이미 답변된 단계를 다음 질문으로 잘못 생성할 수 있어 폴백으로만 쓴다.
      const stored = useStore.getState().questionByStep[step];
      useStore.getState().gotoStep({
        step: data.step as AnswerableStep,
        answers: data.answers,
        aiMessage: stored?.aiMessage ?? data.question.aiMessage,
        quickReplies: stored?.quickReplies ?? data.question.quickReplies,
        insight: data.question.insight,
        matches: data.question.matches,
      });
      setInput(data.previousAnswer ?? "");
    } catch (err) {
      toast.error(`단계 이동 실패: ${(err as Error).message}`);
    } finally {
      useStore.getState().setPending(false);
    }
  };

  const finalize = async () => {
    useStore.getState().setPending(true);
    try {
      toast.info("PPT 생성 중... 최대 30초 소요");
      const res = await fetch("/api/interview/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: state.documentId, securityLevel }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
        );
      }
      const versionId = body.versionId as string | undefined;
      if (versionId) {
        toast.success("PPT 생성 완료");
        router.push(`/deck/${versionId}`);
      } else {
        toast.success("5문답 완료");
        router.refresh();
      }
    } catch (err) {
      toast.error(`finalize 실패: ${(err as Error).message}`);
    } finally {
      useStore.getState().setPending(false);
    }
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-x-6 gap-y-4 px-6 py-8 lg:grid-cols-[1fr_320px]">
      <header className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
        <h1 className="font-heading text-heading-4 text-ink">{typeLabel}</h1>
        <ProgressTrack
          currentStep={state.currentStep}
          answers={state.answers}
          onGoto={goto}
          disabled={state.pending}
        />
      </header>

      <section className="flex flex-col gap-4 lg:col-start-1 lg:row-start-2">
        <div className="flex-1 rounded-lg border bg-card px-4">
          <MessageList turns={state.turns} pending={state.pending} />
        </div>

        {state.done ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <p className="text-sm">
              5문답이 모두 끝났습니다. PPT 초안을 생성할까요?
            </p>
            <Button
              type="button"
              disabled={state.pending}
              onClick={finalize}
            >
              {state.pending ? "문서 생성 중..." : "문서 생성"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {state.currentStep === "length" ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-50 flex-1 space-y-1">
                  <span className="block text-xs text-muted-foreground">
                    분량
                  </span>
                  <Select
                    items={LENGTH_ITEMS}
                    value={lengthChoice || null}
                    onValueChange={(v: string | null) => {
                      const val = v ?? "";
                      setLengthChoice(val);
                      setInput(val);
                    }}
                  >
                    <SelectTrigger aria-label="분량 선택">
                      <SelectValue placeholder="분량 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {LENGTH_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-50 flex-1 space-y-1">
                  <span className="block text-xs text-muted-foreground">
                    보안 레벨
                  </span>
                  <Select
                    items={SECURITY_ITEMS}
                    value={String(securityLevel)}
                    onValueChange={(v: string | null) =>
                      setSecurityLevel((Number(v ?? "1") || 1) as 1 | 2 | 3 | 4 | 5)
                    }
                  >
                    <SelectTrigger aria-label="보안 레벨 선택">
                      <SelectValue placeholder="보안 레벨 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECURITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <QuickReplies
                options={state.quickReplies}
                onPick={submit}
                disabled={state.pending}
              />
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="직접 입력"
                disabled={state.pending || !isAnswerable(state.currentStep)}
              />
              <Button
                type="submit"
                disabled={
                  state.pending ||
                  input.trim().length === 0 ||
                  !isAnswerable(state.currentStep)
                }
              >
                {state.pending ? "전송 중..." : "직접 입력"}
              </Button>
            </form>
          </div>
        )}
      </section>

      <aside className="lg:col-start-2 lg:row-start-2 lg:sticky lg:top-20 lg:self-start">
        <InsightBox insight={state.insight} matches={state.matches} />
      </aside>
    </main>
  );
}
