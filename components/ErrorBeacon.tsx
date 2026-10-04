"use client";

import { useEffect } from "react";

/** Gửi tối đa 3 báo lỗi mỗi lần mở trang. Chỉ gồm thông điệp lỗi, đường dẫn trang và loại trình duyệt. */
export function ErrorBeacon() {
  useEffect(() => {
    let sent = 0;
    const send = (m: string, s?: string) => {
      if (sent >= 3) return;
      sent++;
      try {
        navigator.sendBeacon("/api/client-error", JSON.stringify({ m, s, p: location.pathname, ua: navigator.userAgent }));
      } catch { /* bỏ qua */ }
    };
    const onError = (e: ErrorEvent) => send(e.message, e.error?.stack);
    const onReject = (e: PromiseRejectionEvent) => send(String(e.reason?.message ?? e.reason), e.reason?.stack);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, []);
  return null;
}
