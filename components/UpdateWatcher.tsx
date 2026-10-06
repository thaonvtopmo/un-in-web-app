"use client";

import { useEffect, useState } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_EVERY = 5 * 60_000;

/**
 * Điện thoại giữ app mở trong bộ nhớ rất lâu nên dễ dùng mã cũ dù đã có bản sửa lỗi.
 * Hỏi máy chủ mã phiên bản: khác bản đang chạy thì tự tải lại khi người dùng quay lại app (không làm mất việc đang làm,
 * vì app đã ghi nhớ người đang chơi), hoặc hiện nút "Cập nhật" nếu đang mở sẵn.
 */
export function UpdateWatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (BUILD === "dev") return;
    let alive = true;
    let hiddenWhileStale = false;
    async function check(): Promise<boolean> {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return false;
        const { v } = (await r.json()) as { v?: string };
        const isNew = Boolean(v) && v !== "dev" && v !== BUILD;
        if (alive && isNew) setStale(true);
        return isNew;
      } catch { return false; }
    }
    const onVisible = async () => {
      if (document.visibilityState === "hidden") { hiddenWhileStale = true; return; }
      if (hiddenWhileStale && (await check())) {
        // vừa quay lại app sau khi tắt màn hình: tải bản mới ngay
        try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs ?? []).map((g) => g.update())); } catch { /* bỏ qua */ }
        location.reload();
      }
      hiddenWhileStale = false;
    };
    document.addEventListener("visibilitychange", onVisible);
    const first = setTimeout(() => void check(), 4000);
    const timer = setInterval(() => void check(), CHECK_EVERY);
    return () => { alive = false; clearTimeout(first); clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  if (!stale) return null;
  return (
    <div role="status" style={{ position: "fixed", left: 12, right: 12, bottom: "calc(env(safe-area-inset-bottom) + 84px)", zIndex: 60, display: "flex", justifyContent: "center" }}>
      <div className="card row" style={{ gap: 10, background: "var(--coin-soft)", maxWidth: 420 }}>
        <span className="grow" style={{ fontWeight: 800, fontSize: 14 }}>Ủn Ỉn có bản mới, đã sửa lỗi.</span>
        <button className="btn sm mint" onClick={() => location.reload()}>Cập nhật</button>
      </div>
    </div>
  );
}
