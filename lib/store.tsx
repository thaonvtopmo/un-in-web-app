"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Backend, NewMember } from "./backend";
import { STICKERS, jarTotal, mem, partnerLabel, taskOf } from "./data";
import type { AppState, Data, ParentTab, Screen, Slot, Tier, Who } from "./types";
import type { IconName } from "@/components/Icon";

/**
 * Store của app. Dữ liệu (Data) luôn do server là nguồn sự thật:
 * mỗi thao tác gọi hàm server → tải lại dữ liệu → giao diện cập nhật.
 * Thay đổi từ máy khác đến qua Realtime và cũng kích hoạt tải lại.
 * Trạng thái giao diện (màn hình đang mở, PIN, toast...) chỉ nằm ở trình duyệt.
 */

type Draft = AppState;

const initialUI = (judgeFor: string): AppState["U"] => ({
  member: null, screen: "profiles", pinFor: null, pin: "", pinErr: false, toast: null,
  celebrate: null, timerEnd: null, ptab: "approve", judgeFor, sticker: {},
});

const toast = (d: Draft, msg: string) => {
  d.U.toast = { msg, id: Date.now() + Math.random() };
};

const KID_SCREENS: Screen[] = ["home", "missions", "arena", "shop", "jar", "judge", "summary"];

/** Đổi mã lỗi của server thành câu dễ hiểu */
function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m.includes("outside_window")) return "Ủn đang ngủ, chưa tới giờ chơi nhé";
  if (m.includes("time_up")) return "Hết giờ chơi rồi, mai gặp lại nhé";
  if (m.includes("insufficient")) return "Chưa đủ Ủn rồi";
  if (m.includes("jar_closed")) return "Hũ đã đầy, chờ bố mẹ đặt mục tiêu mới nhé";
  if (m.includes("self_review")) return "Không tự gật đầu cho mình được";
  if (m.includes("wrong_pin")) return "PIN hiện tại chưa đúng";
  if (m.includes("pin_locked")) return "Nhập sai nhiều lần, thử lại sau 5 phút";
  return "Chưa làm được, kiểm tra mạng rồi thử lại nhé";
}

export type Actions = ReturnType<typeof makeActions>;

type Env = {
  backend: Backend;
  mutate: (fn: (d: Draft) => void) => void;
  get: () => AppState;
  reload: () => Promise<void>;
};

function makeActions({ backend, mutate, get, reload }: Env) {
  /** Chạy một thao tác server, tải lại dữ liệu, rồi báo kết quả. Trả về true nếu thành công. */
  async function run(fn: () => Promise<unknown>, okMsg?: string): Promise<boolean> {
    try {
      await fn();
      await reload();
      if (okMsg) mutate((d) => toast(d, okMsg));
      return true;
    } catch (e) {
      const msg = errorText(e);
      const m = e instanceof Error ? e.message : "";
      mutate((d) => {
        toast(d, msg);
        // Server báo ngoài giờ / hết phút thì đưa con về màn tương ứng
        if (KID_SCREENS.includes(d.U.screen)) {
          if (m.includes("outside_window")) { d.U.screen = "sleep"; d.U.timerEnd = null; }
          else if (m.includes("time_up")) { d.U.screen = "timeout"; d.U.timerEnd = null; }
        }
      });
      return false;
    }
  }

  async function startKid(id: string) {
    try {
      const [ss, S] = await Promise.all([backend.kidSession(id), backend.load()]);
      mutate((d) => {
        d.S = S;
        d.U.member = id;
        if (!ss.inWindow) { d.U.screen = "sleep"; return; }
        if (ss.remaining <= 0) { d.U.screen = "timeout"; return; }
        d.U.screen = "home";
        d.U.timerEnd = Date.now() + ss.remaining * 1000;
        const unseen = S.subs.filter((s) => s.member === id && s.status === "approved" && !s.seen);
        if (unseen.length) d.U.celebrate = { type: "coins", ids: unseen.map((s) => s.id) };
      });
    } catch (e) {
      mutate((d) => toast(d, errorText(e)));
    }
  }

  return {
    pick: (id: string) => {
      const m = mem(get().S, id);
      if (m.role === "parent") mutate((d) => { d.U.pinFor = id; d.U.pin = ""; d.U.pinErr = false; });
      else void startKid(id);
    },
    key: (digit: string) => mutate((d) => { if (d.U.pin.length < 4) { d.U.pin += digit; d.U.pinErr = false; } }),
    del: () => mutate((d) => { d.U.pin = d.U.pin.slice(0, -1); }),
    pinClose: () => mutate((d) => { d.U.pinFor = null; d.U.pin = ""; d.U.pinErr = false; }),
    go: (s: Screen) => {
      mutate((d) => { d.U.screen = s; });
      if (typeof window !== "undefined") window.scrollTo(0, 0);
    },
    logout: () => mutate((d) => { d.U.member = null; d.U.screen = "profiles"; d.U.timerEnd = null; d.U.celebrate = null; }),
    timeout: () => mutate((d) => { d.U.screen = "timeout"; d.U.timerEnd = null; d.U.celebrate = null; }),
    stick: (sid: string, i: number) => mutate((d) => { d.U.sticker[sid] = STICKERS[i]; }),
    judgeFor: (v: string) => mutate((d) => { d.U.judgeFor = v; }),
    ptab: (v: ParentTab) => mutate((d) => { d.U.ptab = v; }),

    /** Heartbeat 30 giây: cộng thời gian đã chơi ở server, hết phút hoặc ngoài giờ thì dừng */
    async heartbeat() {
      const k = get().U.member;
      if (!k) return;
      try {
        const [remaining, ss] = await Promise.all([backend.heartbeat(k, 30), backend.kidSession(k)]);
        mutate((d) => {
          if (!ss.inWindow) { d.U.screen = "sleep"; d.U.timerEnd = null; d.U.celebrate = null; }
          else if (remaining <= 0) { d.U.screen = "timeout"; d.U.timerEnd = null; d.U.celebrate = null; }
          else d.U.timerEnd = Date.now() + remaining * 1000;
        });
      } catch { /* mất mạng thoáng qua: giữ nguyên, lần sau thử lại */ }
    },

    done: (tid: string) => run(() => backend.submitTask(get().U.member!, tid), "Đã gửi! Chờ bố mẹ gật đầu nhé"),

    approve(sid: string) {
      const { S, U } = get();
      const s = S.subs.find((x) => x.id === sid);
      if (!s) return;
      const t = taskOf(S, s.task);
      const msg = t.who === "together"
        ? `Đã gật đầu! +${t.coins} Ủn cho ${mem(S, s.member).name} và ${partnerLabel(S, t)}`
        : `Đã gật đầu +${t.coins} Ủn cho ${mem(S, s.member).name}`;
      return run(() => backend.approve(sid, U.member!, U.sticker[sid] || STICKERS[0]), msg);
    },
    remind: (sid: string) => run(() => backend.remind(sid), "Đã nhắc con làm lại"),
    judge: (tid: string) => { const { U } = get(); return run(() => backend.judge(U.judgeFor, tid, U.member!)); },

    async redeem(rid: string) {
      const { S, U } = get();
      const r = S.rewards.find((x) => x.id === rid);
      if (!r) return;
      const k = U.member!;
      if (S.coins[k] < r.cost) { mutate((d) => toast(d, `Còn thiếu ${r.cost - S.coins[k]} Ủn nữa!`)); return; }
      if (await run(() => backend.redeem(k, rid))) mutate((d) => { d.U.celebrate = { type: "redeem", title: r.title }; });
    },
    async give() {
      const { S, U } = get();
      const k = U.member!;
      if (S.jar.reached) { mutate((d) => toast(d, "Hũ đã đầy, chờ bố mẹ đặt mục tiêu mới nhé")); return; }
      if (S.coins[k] < 20) { mutate((d) => toast(d, "Chưa đủ 20 Ủn")); return; }
      let reached = false;
      const ok = await run(async () => { reached = await backend.contributeJar(k, S.jar.id, 20); });
      if (ok) mutate((d) => { if (reached) d.U.celebrate = { type: "jar" }; else toast(d, "Đã góp 20 Ủn vào hũ!"); });
    },
    closeCelebrate() {
      const c = get().U.celebrate;
      mutate((d) => { d.U.celebrate = null; });
      if (c && c.type === "coins") void run(() => backend.markSeen(c.ids));
    },

    promiseDone: (id: string) => run(() => backend.completePromise(id), "Tuyệt! Đã giữ lời hứa"),
    delTask: (id: string) => run(() => backend.removeTask(id), "Đã xoá việc tốt"),
    delReward: (id: string) => run(() => backend.removeReward(id), "Đã xoá phiếu"),
    chal: (cid: string, who: string) => run(() => backend.bumpChallenge(cid, who)),
    delChal: (id: string) => run(() => backend.removeChallenge(id)),

    addTask(v: { title: string; coins: number; slot: Slot; who: Who; icon: IconName }) {
      const title = v.title.trim();
      if (!title) return;
      return run(() => backend.addTask({ ...v, title, coins: Math.min(200, Math.max(1, v.coins || 1)) }), "Đã thêm việc tốt");
    },
    addReward(v: { title: string; cost: number; tier: Tier; icon: IconName }) {
      const title = v.title.trim();
      if (!title) return;
      return run(() => backend.addReward({ ...v, title, cost: Math.max(1, v.cost || 1) }), "Đã thêm phiếu");
    },
    addChal(v: { a: string; b: string; title: string; target: number; prize: string; linkedTask?: string }) {
      const title = v.title.trim();
      if (!title || v.a === v.b) { mutate((d) => toast(d, "Chọn 2 người khác nhau và đặt tên thử thách")); return; }
      return run(() => backend.addChallenge({ ...v, title, target: Math.min(14, Math.max(1, v.target || 5)), prize: v.prize.trim() || "Người thắng được chọn hoạt động cuối tuần" }), "Đã lên kèo");
    },
    async saveSettings(v: { familyName: string; oldPin: string; newPin: string; start: string; end: string; minutes: number; enforce: boolean; leaderboard: boolean; goal: string; target: number }) {
      const { S } = get();
      const newPin = v.newPin.trim();
      if (newPin && !/^\d{4}$/.test(newPin)) { mutate((d) => toast(d, "PIN mới phải gồm 4 chữ số")); return; }
      const minutes = Math.min(60, Math.max(1, v.minutes || 10));
      const goal = v.goal.trim() || S.jar.goal;
      const target = Math.max(50, v.target || S.jar.target);
      await run(async () => {
        await backend.saveSettings({ familyName: v.familyName, start: v.start, end: v.end, minutes, enforce: v.enforce, leaderboard: v.leaderboard, oldPin: v.oldPin.trim(), newPin: newPin || undefined });
        if (goal !== S.jar.goal || target !== S.jar.target) await backend.setJarGoal(goal, target);
      }, newPin ? "Đã lưu cài đặt và đổi PIN" : "Đã lưu cài đặt");
    },
    addMember(v: NewMember) {
      const name = v.name.trim();
      if (!name) return;
      return run(() => backend.addMember({ name, role: v.role }), `Đã thêm ${name}`);
    },
    removeMember: (id: string) => run(() => backend.removeMember(id), "Đã xoá thành viên"),
    leaderboard: () => backend.leaderboard(),
  };
}

type Ctx = { S: Data; U: AppState["U"]; A: Actions; demo: boolean; signOut: () => void };
const AppContext = createContext<Ctx | null>(null);

type ProviderProps = {
  initialData: Data;
  backend: Backend;
  demo?: boolean;
  onSignOut?: () => void;
  children: ReactNode;
};

/** Store nhỏ nằm ngoài React để hành động đọc được trạng thái mới nhất */
function createStore(initial: AppState) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    update(fn: (prev: AppState) => AppState) {
      state = fn(state);
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => { subs.delete(f); };
    },
  };
}

export function AppProvider({ initialData, backend, demo = false, onSignOut, children }: ProviderProps) {
  const [store] = useState(() =>
    createStore({
      S: initialData,
      U: initialUI(initialData.members.find((m) => m.role === "parent")?.id ?? ""),
    }),
  );
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);

  const mutate = useCallback((fn: (d: Draft) => void) => {
    store.update((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, [store]);

  const reload = useCallback(async () => {
    try {
      const S = await backend.load();
      store.update((p) => ({ ...p, S }));
    } catch { /* giữ dữ liệu cũ nếu tải lỗi */ }
  }, [backend, store]);

  const A = useMemo(() => makeActions({ backend, mutate, get: store.get, reload }), [backend, mutate, store, reload]);

  // Đồng bộ thời gian thực: máy khác thay đổi thì tải lại. Tải lại khi quay lại tab (điện thoại ngủ làm rớt kết nối).
  useEffect(() => {
    const off = backend.subscribe(() => void reload());
    const onVisible = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { off(); document.removeEventListener("visibilitychange", onVisible); };
  }, [backend, reload]);

  // Đủ 4 số PIN thì hỏi server (PIN không bao giờ nằm ở trình duyệt)
  const verifying = useRef(false);
  const { pin, pinFor } = state.U;
  useEffect(() => {
    if (pin.length !== 4 || !pinFor || verifying.current) return;
    verifying.current = true;
    backend
      .verifyPin(pin)
      .then((ok) =>
        mutate((d) => {
          if (ok && d.U.pinFor) {
            const name = mem(d.S, d.U.pinFor).name;
            d.U.member = d.U.pinFor; d.U.pinFor = null; d.U.screen = "parent"; d.U.ptab = "approve"; d.U.timerEnd = null; d.U.pin = "";
            toast(d, "Chào " + name + "!");
          } else {
            d.U.pinErr = true; d.U.pin = "";
          }
        }),
      )
      .catch((e: unknown) =>
        mutate((d) => {
          d.U.pin = ""; d.U.pinErr = true;
          toast(d, e instanceof Error && e.message === "pin_locked" ? "Nhập sai 5 lần rồi, thử lại sau 5 phút nhé" : "Chưa kiểm tra được PIN, thử lại nhé");
        }),
      )
      .finally(() => { verifying.current = false; });
  }, [pin, pinFor, backend, mutate]);

  // Toast tự tắt sau 2,2 giây
  const toastId = state.U.toast?.id;
  useEffect(() => {
    if (toastId == null) return;
    const t = setTimeout(() => mutate((d) => { if (d.U.toast?.id === toastId) d.U.toast = null; }), 2200);
    return () => clearTimeout(t);
  }, [toastId, mutate]);

  const value = useMemo(
    () => ({ S: state.S, U: state.U, A, demo, signOut: onSignOut ?? (() => {}) }),
    [state, A, demo, onSignOut],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp phải nằm trong AppProvider");
  return ctx;
}

export { jarTotal };
