import { useEffect, useSyncExternalStore } from "react";

import type { AnalysisResult, DatasetSummary } from "./ml/pipeline";

export type Stage = "empty" | "loaded" | "cleaned" | "trained";

export type AppState = {
  fileName: string | null;
  csvText: string | null;
  summary: DatasetSummary | null;
  target: string | null;
  result: AnalysisResult | null;
  history: AnalysisHistoryEntry[];
  stage: Stage;
};

export type AnalysisHistoryEntry = {
  id: string;
  createdAt: string;
  result: AnalysisResult;
};

const initialState: AppState = {
  fileName: null,
  csvText: null,
  summary: null,
  target: null,
  result: null,
  history: [],
  stage: "empty",
};

let state: AppState = initialState;
let hydrated = false;
const listeners = new Set<() => void>();
const STORAGE_KEY = "bigdata-ml-analytics-state-v1";

function persist() {
  if (typeof window === "undefined") return;
  try {
    const durableState = {
      ...state,
      csvText: null,
      stage: state.result ? "trained" : "empty",
      summary: state.result?.summary ?? null,
      fileName: state.result?.summary.fileName ?? null,
      target: state.result?.target ?? null,
    } satisfies AppState;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(durableState));
  } catch {
    // The app remains usable when browser storage is unavailable or full.
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as Partial<AppState>;
    state = {
      ...initialState,
      ...parsed,
      csvText: null,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 20) : [],
    };
    emit();
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function emit() {
  for (const l of listeners) l();
}

export function setDataset(fileName: string, csvText: string, summary: DatasetSummary) {
  state = {
    fileName,
    csvText,
    summary,
    target: summary.suggestedTarget,
    result: null,
    history: state.history,
    stage: "loaded",
  };
  persist();
  emit();
}

export function setTarget(target: string) {
  state = { ...state, target };
  persist();
  emit();
}

export function setResult(result: AnalysisResult) {
  const entry: AnalysisHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    result,
  };
  state = {
    ...state,
    result,
    summary: result.summary,
    fileName: result.summary.fileName,
    target: result.target,
    stage: "trained",
    history: [entry, ...state.history].slice(0, 20),
  };
  persist();
  emit();
}

export function restoreResult(result: AnalysisResult) {
  state = {
    ...state,
    result,
    summary: result.summary,
    fileName: result.summary.fileName,
    target: result.target,
    stage: "trained",
  };
  persist();
  emit();
}

export function markCleaned() {
  if (state.stage === "loaded") {
    state = { ...state, stage: "cleaned" };
    persist();
    emit();
  }
}

export function resetDataset() {
  state = { ...initialState, history: state.history };
  persist();
  emit();
}

export function clearHistory() {
  state = { ...state, history: [] };
  persist();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => initialState,
  );
  useEffect(hydrate, []);
  return snapshot;
}
