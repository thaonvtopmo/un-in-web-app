"use client";

import { useEffect, useState } from "react";
import type { DaySummary } from "./review";
import { useApp } from "./store";

/**
 * Tổng kết từng người từng ngày trong khoảng [from, to]. Tự tải lại khi dữ liệu đổi
 * (có việc vừa được nộp hoặc gật đầu...).
 */
export function useReview(from: string, to: string) {
  const { S, A } = useApp();
  const [state, setState] = useState<{ key: string; rows: DaySummary[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${from}|${to}`;
  const version = S.subs.length * 31 + S.subs.filter((s) => s.status === "approved").length * 7 + S.tasks.length + Object.values(S.coins).reduce((a, b) => a + b, 0);

  useEffect(() => {
    let alive = true;
    A.reviewRange(from, to)
      .then((rows) => { if (alive) { setState({ key, rows }); setFailed(null); } })
      .catch(() => { if (alive) setFailed(key); });
    return () => { alive = false; };
  }, [A, from, to, key, version]);

  const ready = state && state.key === key ? state.rows : null;
  return { rows: ready, loading: ready === null && failed !== key, failed: failed === key && ready === null };
}
