"use client";

import { useEffect, useState } from "react";
import { CsoResponse } from "@/types";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // matches the route's 5-min cache

interface CsoDataState {
  data: CsoResponse | null;
  loading: boolean;
  error: boolean;
}

// Module-level singleton fetch/poll, shared by every component calling
// useCsoData() - the status card and the full outfall list both need the
// same data, and the route's reverse-geocoding pass is expensive enough
// that it shouldn't run twice per poll just because two cards want it.
let state: CsoDataState = { data: null, loading: true, error: false };
const listeners = new Set<(next: CsoDataState) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

const setState = (next: CsoDataState) => {
  state = next;
  listeners.forEach((listener) => listener(state));
};

const load = async () => {
  try {
    const res = await fetch("/api/sewage");
    if (!res.ok) throw new Error("Failed to fetch");
    const body: CsoResponse = await res.json();
    setState({ data: body, loading: false, error: false });
  } catch {
    setState({ ...state, loading: false, error: true });
  }
};

export const useCsoData = (): CsoDataState => {
  const [local, setLocal] = useState(state);

  useEffect(() => {
    listeners.add(setLocal);
    if (listeners.size === 1) {
      load();
      intervalId = setInterval(load, REFRESH_INTERVAL_MS);
    }
    return () => {
      listeners.delete(setLocal);
      if (listeners.size === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, []);

  return local;
};
