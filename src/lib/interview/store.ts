"use client";

import { create } from "zustand";
import {
  ANSWERABLE_STEPS,
  STEPS,
  STEP_LABELS,
  isAnswerable,
  type AnswerableStep,
  type Answers,
  type Step,
} from "./machine";

export type ChatTurn =
  | { role: "ai"; text: string; quickReplies?: string[] }
  | { role: "user"; text: string };

export type KbMatchView = {
  sourceId: string;
  title: string | null;
  text: string;
  sim: number;
};

type QInfo = { aiMessage: string; quickReplies: string[] };

type StoreState = {
  documentId: string;
  documentType: string;
  currentStep: Step;
  answers: Answers;
  turns: ChatTurn[];
  quickReplies: string[];
  insight?: string;
  matches: KbMatchView[];
  pending: boolean;
  done: boolean;
  // 단계별로 마지막에 보여준 질문 텍스트(되돌리기 시 대화 재구성에 사용).
  questionByStep: Partial<Record<AnswerableStep, QInfo>>;
  setPending: (p: boolean) => void;
  pushUser: (text: string) => void;
  pushAi: (text: string, quickReplies?: string[]) => void;
  applyNext: (next: {
    step: Step;
    answers: Answers;
    aiMessage?: string;
    quickReplies?: string[];
    insight?: string;
    matches?: KbMatchView[];
    done?: boolean;
  }) => void;
  gotoStep: (args: {
    step: AnswerableStep;
    answers: Answers;
    aiMessage: string;
    quickReplies: string[];
    insight?: string;
    matches?: KbMatchView[];
  }) => void;
};

export type InitialChatState = {
  documentId: string;
  documentType: string;
  currentStep: Step;
  answers: Answers;
  initialQuestion: {
    aiMessage: string;
    quickReplies: string[];
    insight?: string;
    matches: KbMatchView[];
  } | null;
};

function restoredQuestionText(step: string): string {
  const label = STEP_LABELS[step as AnswerableStep] ?? step;
  return `(${label} 질문)`;
}

export function buildInitialTurns(init: InitialChatState): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const [step, answer] of Object.entries(init.answers)) {
    if (!answer) continue;
    turns.push({ role: "ai", text: restoredQuestionText(step) });
    turns.push({ role: "user", text: answer });
  }
  if (init.initialQuestion) {
    turns.push({
      role: "ai",
      text: init.initialQuestion.aiMessage,
      quickReplies: init.initialQuestion.quickReplies,
    });
  }
  return turns;
}

function buildInitialQuestionByStep(
  init: InitialChatState,
): Partial<Record<AnswerableStep, QInfo>> {
  // 복원 세션의 과거 단계 질문 원문은 보관돼 있지 않다. placeholder("(독자 질문)" 등)를
  // map 에 넣으면 되돌아갈 때 그 자리표시자가 그대로 노출되므로, 실제 질문(현재 단계의
  // initialQuestion)만 담는다. 과거 단계로 되돌아가면 서버가 해당 단계 질문을 재생성한다.
  const map: Partial<Record<AnswerableStep, QInfo>> = {};
  if (init.initialQuestion && isAnswerable(init.currentStep)) {
    map[init.currentStep as AnswerableStep] = {
      aiMessage: init.initialQuestion.aiMessage,
      quickReplies: init.initialQuestion.quickReplies,
    };
  }
  return map;
}

export function createInterviewStore(init: InitialChatState) {
  return create<StoreState>((set) => ({
    documentId: init.documentId,
    documentType: init.documentType,
    currentStep: init.currentStep,
    answers: init.answers,
    turns: buildInitialTurns(init),
    quickReplies: init.initialQuestion?.quickReplies ?? [],
    insight: init.initialQuestion?.insight,
    matches: init.initialQuestion?.matches ?? [],
    pending: false,
    done: false,
    questionByStep: buildInitialQuestionByStep(init),
    setPending: (p) => set({ pending: p }),
    pushUser: (text) =>
      set((s) => ({
        turns: [...s.turns, { role: "user", text }],
        quickReplies: [],
      })),
    pushAi: (text, quickReplies) =>
      set((s) => ({
        turns: [...s.turns, { role: "ai", text, quickReplies }],
        quickReplies: quickReplies ?? [],
      })),
    applyNext: (next) =>
      set((s) => {
        const turns: ChatTurn[] = [...s.turns];
        const questionByStep = { ...s.questionByStep };
        if (next.aiMessage) {
          turns.push({
            role: "ai",
            text: next.aiMessage,
            quickReplies: next.quickReplies,
          });
          if (isAnswerable(next.step)) {
            questionByStep[next.step as AnswerableStep] = {
              aiMessage: next.aiMessage,
              quickReplies: next.quickReplies ?? [],
            };
          }
        }
        return {
          currentStep: next.step,
          answers: next.answers,
          turns,
          questionByStep,
          quickReplies: next.quickReplies ?? [],
          insight: next.insight,
          matches: next.matches ?? s.matches,
          done: next.done ?? false,
        };
      }),
    gotoStep: ({ step, answers, aiMessage, quickReplies, insight, matches }) =>
      set((s) => {
        const questionByStep = {
          ...s.questionByStep,
          [step]: { aiMessage, quickReplies },
        };
        // 대화 rewind: 대상 단계 이전의 답변된 단계만 Q/A 로 재구성하고, 마지막에 대상 질문을 둔다.
        const targetIdx = STEPS.indexOf(step);
        const turns: ChatTurn[] = [];
        for (const past of ANSWERABLE_STEPS) {
          if (STEPS.indexOf(past) >= targetIdx) break;
          const ans = answers[past];
          if (ans == null) continue;
          const q = questionByStep[past];
          turns.push({
            role: "ai",
            text: q?.aiMessage ?? restoredQuestionText(past),
            quickReplies: q?.quickReplies,
          });
          turns.push({ role: "user", text: ans });
        }
        turns.push({ role: "ai", text: aiMessage, quickReplies });
        return {
          currentStep: step,
          answers,
          questionByStep,
          turns,
          quickReplies,
          insight,
          matches: matches ?? s.matches,
          done: false,
        };
      }),
  }));
}

export type InterviewStore = ReturnType<typeof createInterviewStore>;
