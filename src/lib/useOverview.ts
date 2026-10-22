"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Overview } from "./types";

const POLL_MS = 3000;

// Keeps the overview fresh by asking the server every few seconds while `enabled`.
export function useOverview(code: string | null, enabled: boolean) {
  const [state, setState] = useState<{ code: string; overview: Overview } | null>(null);
  const [lastOk, setLastOk] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!code || busy.current) return;
    busy.current = true;
    try {
      const res = await fetch(`/api/fest/${code}/overview`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setState({ code, overview: json.overview });
      setLastOk(new Date());
      setStale(false);
    } catch {
      setStale(true); // keep showing the last numbers, but say they are old
    } finally {
      busy.current = false;
    }
  }, [code]);

  useEffect(() => {
    if (!code || !enabled) return;
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [code, enabled, refresh]);

  const data = state && state.code === code ? state.overview : null;
  return { data, stale, lastOk, refresh };
}
