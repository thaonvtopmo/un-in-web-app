"use client";

import { useEffect } from "react";

/** Đăng ký service worker để cài app lên màn hình chính (chỉ bản chạy thật, không phải lúc phát triển) */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
