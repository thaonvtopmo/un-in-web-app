"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AppProvider, useApp } from "@/lib/store";
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

const subscribe = () => () => {};

/** Dữ liệu mẫu phụ thuộc ngày giờ của trình duyệt nên chỉ dựng phía client (tránh lệch SSR) */
export default function App() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
