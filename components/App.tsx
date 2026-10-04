"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getFamilyId, supabaseBackend, type Backend } from "@/lib/backend";
import { demoBackend } from "@/lib/demo";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { AppProvider, useApp } from "@/lib/store";
import type { Data } from "@/lib/types";
import { Login, Setup, Splash } from "./screens/auth";
import { CelebrateOverlay, PinDialog, Profiles, SleepScreen, Toast } from "./screens/common";
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
      {U.pinFor && <PinDialog />}
      {U.celebrate && <CelebrateOverlay />}
      <Toast />
    </>
  );
}

type Loaded = { backend: Backend; data: Data };

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

  const refresh = useCallback(async () => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return setPhase({ kind: "login" });
    try {
      const familyId = await getFamilyId();
      if (!familyId) return setPhase({ kind: "setup", email: session.user.email ?? "" });
      const backend = supabaseBackend(familyId);
      setPhase({ kind: "ready", familyId, loaded: { backend, data: await backend.load() } });
    } catch {
      setPhase({ kind: "error" });
    }
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
        <main className="app" style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <h1>Chưa kết nối được</h1>
          <p className="muted">Kiểm tra mạng rồi tải lại trang nhé.</p>
          <button className="btn" onClick={() => location.reload()}>Tải lại</button>
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
