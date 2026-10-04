"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/lib/store";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "checking" | "unsupported" | "denied" | "off" | "on";

/** Bật/tắt thông báo đẩy trên thiết bị đang dùng (cần cài app lên màn hình chính trên iPhone/iPad) */
export function NotificationToggle() {
  const { A, demo } = useApp();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(VAPID);
    if (!supported) { Promise.resolve().then(() => alive && setState("unsupported")); return () => { alive = false; }; }
    if (Notification.permission === "denied") { Promise.resolve().then(() => alive && setState("denied")); return () => { alive = false; }; }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      if (alive) setState(sub ? "on" : "off");
    }).catch(() => alive && setState("off"));
    return () => { alive = false; };
  }, []);

  if (demo) return null;

  async function enable() {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID) }));
      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) throw new Error("subscription");
      await A.pushSubscribe({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } }, navigator.userAgent.slice(0, 80));
      setState("on");
      A.toast("Đã bật thông báo trên máy này");
    } catch {
      setMsg("Chưa bật được. Hãy thử lại sau khi cài app lên màn hình chính.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true); setMsg("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await A.pushUnsubscribe(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
      A.toast("Đã tắt thông báo trên máy này");
    } catch {
      setMsg("Chưa tắt được, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const sent = await A.notify("test");
    setBusy(false);
    A.toast(sent > 0 ? "Đã gửi thông báo thử" : "Chưa có thiết bị nào nhận được");
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <h3 style={{ marginTop: 6 }}>Thông báo</h3>
      <div className="muted">Nhận thông báo khi con làm xong việc, con đổi phiếu và nhắc nhẹ mỗi ngày.</div>
      {state === "checking" && <div className="muted">Đang kiểm tra...</div>}
      {state === "unsupported" && (
        <div className="card" style={{ background: "var(--sand)", boxShadow: "none" }}>
          Máy này chưa hỗ trợ thông báo. Trên iPhone/iPad: bấm Chia sẻ → &quot;Thêm vào Màn hình chính&quot;, mở app từ biểu tượng đó rồi vào lại đây.
        </div>
      )}
      {state === "denied" && (
        <div className="card" style={{ background: "var(--pink-soft)", boxShadow: "none" }}>
          Thông báo đang bị chặn. Mở cài đặt trình duyệt của trang này và cho phép Thông báo, rồi tải lại trang.
        </div>
      )}
      {state === "off" && <button className="btn" type="button" onClick={enable} disabled={busy}><Icon name="bell" size={18} />Bật thông báo trên máy này</button>}
      {state === "on" && (
        <div className="grid2">
          <button className="btn" type="button" onClick={test} disabled={busy}><Icon name="bell" size={18} />Gửi thử</button>
          <button className="btn ghost" type="button" onClick={disable} disabled={busy}>Tắt trên máy này</button>
        </div>
      )}
      {msg && <div role="alert" style={{ color: "#C2185B", fontWeight: 800, fontSize: 13 }}>{msg}</div>}
    </div>
  );
}
