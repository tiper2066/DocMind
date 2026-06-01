"use client";

import { create } from "zustand";
import type { Answers, Step } from "./machine";

export type ChatTurn =
  | { role: "ai"; text: string; quickReplies?: string[] }
  | { role: "user"; text: string };

export type KbMatchView = {
  sourceId: string;
  title: string | null;
  text: string;
  sim: number;
};

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

export function buildInitialTurns(init: InitialChatState): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const [step, answer] of Object.entries(init.answers)) {
    if (!answer) continue;
    turns.push({
      role: "ai",
      text: `(저장된 ${step} 응답)`,
    });
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
        if (next.aiMessage) {
          turns.push({
            role: "ai",
            text: next.aiMessage,
            quickReplies: next.quickReplies,
          });
        }
        return {
          currentStep: next.step,
          answers: next.answers,
          turns,
          quickReplies: next.quickReplies ?? [],
          insight: next.insight,
          matches: next.matches ?? s.matches,
          done: next.done ?? false,
        };
      }),
  }));
}

export type InterviewStore = ReturnType<typeof createInterviewStore>;
