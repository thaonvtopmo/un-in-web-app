"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getFamilyId, supabaseBackend, type Backend } from "@/lib/backend";
import { demoBackend } from "@/lib/demo";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { AppProvider, useApp } from "@/lib/store";
import type { Data } from "@/lib/types";
import { Pig } from "@/components/Pig";
import { Login, Setup, Splash, resetAndReload } from "./screens/auth";
import { CelebrateOverlay, PinDialog, Profiles, SleepScreen, Toast } from "./screens/common";
import { AlarmWatcher } from "./screens/alarms";
import { KidShell } from "./screens/kid";
import { ParentShell } from "./screens/parent";

function Router() {
  const { U } = useApp();
  const night = U.screen === "sleep" || U.screen === "timeout";

  useEffect(() => {
    document.body.classList.toggle("night", night);
    return () => document.body.classList.remove("night");
  }, [night]);

  let screen;
  if (U.screen === "profiles") screen = <Profiles />;
  else if (U.screen === "sleep") screen = <SleepScreen timeout={false} />;
  else if (U.screen === "timeout") screen = <SleepScreen timeout />;
  else if (U.screen === "parent") screen = <ParentShell />;
  else screen = <KidShell />;

  return (
    <>
      {screen}
      <AlarmWatcher />
      {U.pinFor && <PinDialog />}
      {U.celebrate && <CelebrateOverlay />}
      <Toast />
    </>
  );
}

type Loaded = { backend: Backend; data: Data };

/** Màn lỗi tự kiểm tra xem máy này có với tới máy chủ dữ liệu không, và báo kết quả để dễ tìm nguyên nhân */
function ConnectionCheck() {
  const [msg, setMsg] = useState("Đang kiểm tra kết nối...");
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    const t0 = Date.now();
    const report = (m: string) => { try { navigator.sendBeacon("/api/client-error", JSON.stringify({ m, p: location.pathname, ua: navigator.userAgent })); } catch { /* bỏ qua */ } };
    fetch(url + "/auth/v1/settings", { headers: { apikey: key }, signal: ctl.signal })
      .then((r) => {
        const ms = Date.now() - t0;
        setMsg(r.ok ? `Máy chủ dữ liệu trả lời sau ${ms} ms, kết nối tốt. Lỗi nằm ở phiên đăng nhập cũ trên máy này: bấm "Đăng nhập lại".` : `Máy chủ dữ liệu trả lời lỗi (${r.status}). Thử lại sau ít phút.`);
        report(`conn:${r.status}:${ms}ms`);
      })
      .catch(() => {
        setMsg("Máy này không với tới được máy chủ dữ liệu. Thử đổi sang 4G hoặc Wi-Fi khác, tắt VPN hoặc ứng dụng chặn quảng cáo, rồi tải lại.");
        report("conn:fail");
      })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctl.abort(); };
  }, []);
  return <p role="status" style={{ fontWeight: 800, fontSize: 14 }}>{msg}</p>;
}

/** Chế độ dùng thử: không cần đăng nhập, dữ liệu mẫu trong bộ nhớ */
function DemoApp() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    const backend = demoBackend();
    void backend.load().then((data) => setLoaded({ backend, data }));
  }, []);
  if (!loaded) return <Splash />;
  return (
    <AppProvider initialData={loaded.data} backend={loaded.backend} demo>
      <Router />
    </AppProvider>
  );
}

/** Chờ tối đa `ms` mili giây; quá hạn thì báo lỗi thay vì chờ mãi */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

type Phase =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "setup"; email: string }
  | { kind: "ready"; familyId: string; loaded: Loaded }
  | { kind: "error" };

function AuthGate() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const refresh = useCallback(async (): Promise<void> => {
    // Mạng chập chờn là chuyện thường trên điện thoại: thử lại vài lần trước khi báo lỗi, không bắt đăng nhập lại
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sb = getSupabase();
        const { data: { session } } = await withTimeout(sb.auth.getSession(), 8000);
        if (!session) return setPhase({ kind: "login" });
        const familyId = await withTimeout(getFamilyId(), 12000);
        if (!familyId) return setPhase({ kind: "setup", email: session.user.email ?? "" });
        const backend = supabaseBackend(familyId);
        return setPhase({ kind: "ready", familyId, loaded: { backend, data: await withTimeout(backend.load(), 15000) } });
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    setPhase({ kind: "error" }); // mạng hỏng lâu, phiên cũ bị hỏng, hoặc trình duyệt kẹt khoá đăng nhập
  }, []);

  // Phòng hờ: chờ quá 30 giây (đã gồm các lần thử lại) mà chưa ra màn nào thì hiện màn "chưa kết nối được" có nút chữa
  useEffect(() => {
    const t = setTimeout(() => { if (phaseRef.current.kind === "loading") setPhase({ kind: "error" }); }, 30000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    // INITIAL_SESSION bắn ngay khi đăng ký; SIGNED_IN còn bắn lại khi quay lại tab nên bỏ qua nếu đang chơi
    const { data: { subscription } } = sb.auth.onAuthStateChange((ev) => {
      if (ev === "INITIAL_SESSION" || ev === "SIGNED_OUT" || (ev === "SIGNED_IN" && phaseRef.current.kind !== "ready")) void refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setPhase({ kind: "login" });
  }, []);

  switch (phase.kind) {
    case "loading": return <Splash />;
    case "login": return <Login />;
    case "setup": return <Setup email={phase.email} onDone={() => void refresh()} onSignOut={() => void signOut()} />;
    case "ready":
      return (
        <AppProvider key={phase.familyId} initialData={phase.loaded.data} backend={phase.loaded.backend} onSignOut={() => void signOut()}>
          <Router />
        </AppProvider>
      );
    default:
      return (
        <main className="app" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", maxWidth: 420 }}>
          <Pig mood="sleep" size={100} />
          <h1>Chưa kết nối được</h1>
          <p className="muted">Kiểm tra mạng rồi thử lại. Nếu vẫn đứng yên, bấm &quot;Đăng nhập lại&quot; để làm mới phiên đăng nhập trên máy này (dữ liệu gia đình vẫn an toàn trên máy chủ).</p>
          <ConnectionCheck />
          <button className="btn big coin" onClick={() => location.reload()}>Tải lại</button>
          <button className="btn big" onClick={() => void resetAndReload()}>Đăng nhập lại</button>
        </main>
      );
  }
}

const subscribe = () => () => {};

/** Phụ thuộc trình duyệt (giờ, phiên đăng nhập) nên chỉ dựng phía client */
export default function App() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return <Splash />; // máy chủ vẽ sẵn con heo, người dùng không phải nhìn màn hình trắng
  return isSupabaseConfigured ? <AuthGate /> : <DemoApp />;
}
