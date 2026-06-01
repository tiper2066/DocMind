"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createInterviewStore,
  type InitialChatState,
} from "@/lib/interview/store";
import {
  DOC_TYPE_LABELS,
  isAnswerable,
  STEP_LABELS,
  type AnswerableStep,
} from "@/lib/interview/machine";
import { MessageList } from "./MessageList";
import { QuickReplies } from "./QuickReplies";
import { ProgressTrack } from "./ProgressTrack";
import { InsightBox } from "./InsightBox";

export function ChatView({ initial }: { initial: InitialChatState }) {
  const router = useRouter();
  const [useStore] = useState(() => createInterviewStore(initial));
  const state = useStore();

  const [input, setInput] = useState("");

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
      useStore.getState().gotoStep({
        step: data.step as AnswerableStep,
        answers: data.answers,
        aiMessage: data.question.aiMessage,
        quickReplies: data.question.quickReplies,
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
        body: JSON.stringify({ documentId: state.documentId }),
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
    <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-3">
          <h1 className="font-heading text-heading-4 text-ink">{typeLabel}</h1>
          <ProgressTrack
            currentStep={state.currentStep}
            answers={state.answers}
            onGoto={goto}
            disabled={state.pending}
          />
        </header>

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
              {state.pending ? "전송 중..." : "PPT 생성 시작"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <QuickReplies
              options={state.quickReplies}
              onPick={submit}
              disabled={state.pending}
            />
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
                placeholder={`${STEP_LABELS[state.currentStep as AnswerableStep] ?? "답변"} — 직접 입력`}
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
                {state.pending ? "전송 중..." : "전송"}
              </Button>
            </form>
          </div>
        )}
      </section>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <InsightBox insight={state.insight} matches={state.matches} />
      </aside>
    </main>
  );
}
