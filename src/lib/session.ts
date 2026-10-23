"use client";

// Remembers who you are on this phone, so a refresh doesn't log you out.
// Only your own phone keeps this: your code, name and department. Nothing else.
import { useMemo, useSyncExternalStore } from "react";
import type { Session } from "./types";

const KEY = "cueboard.session";
const listeners = new Set<() => void>();
let inMemory: string | null = null; // used if the browser blocks storage (e.g. private mode)

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? inMemory;
  } catch {
    return inMemory;
  }
}

function notify() {
  listeners.forEach((l) => l());
}

export function saveSession(s: Session) {
  inMemory = JSON.stringify(s);
  try {
    localStorage.setItem(KEY, inMemory);
  } catch {}
  notify();
}

export function clearSession() {
  inMemory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {}
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useStoredSession(): Session | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => {
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      const ok =
        typeof s.festCode === "string" &&
        typeof s.name === "string" &&
        typeof s.department === "string" &&
        typeof s.isOrganiser === "boolean" &&
        typeof s.isHead === "boolean" &&
        typeof s.token === "string" &&
        s.token.length > 0; // sessions saved before sign-in tokens existed are asked to log in again
      return ok ? (s as Session) : null;
    } catch {
      return null;
    }
  }, [raw]);
}
