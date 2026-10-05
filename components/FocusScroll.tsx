"use client";

import { useEffect } from "react";

/** Bấm vào ô nhập trên điện thoại: bàn phím hiện lên thì cuộn ô đó ra giữa màn hình, khỏi phải vuốt tay */
export function FocusScroll() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !el.matches?.("input:not([type=checkbox]):not([type=radio]), textarea, select")) return;
      clearTimeout(timer);
      timer = setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* bỏ qua */ } }, 320);
    };
    document.addEventListener("focusin", onFocus);
    return () => { document.removeEventListener("focusin", onFocus); clearTimeout(timer); };
  }, []);
  return null;
}
