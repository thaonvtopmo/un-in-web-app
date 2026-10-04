"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BGS, STICKERS, hhmm, inWindow, jarTotal, kidTasks, mem, partnerLabel, partnersOf, seedData, subOf, taskOf, today } from "./data";
import type { AppState, Data, ParentTab, Role, Slot, Tier, Who } from "./types";
import type { IconName } from "@/components/Icon";

/**
 * Lớp dữ liệu + hành động của app.
 * Hiện tại dữ liệu nằm trong bộ nhớ (giống bản prototype).
 * Khi gắn Supabase, chỉ cần thay phần thân các hàm trong `actions` bằng lời gọi server,
 * giao diện không phải sửa.
 */

let _id = 100;
const uid = () => "id" + ++_id;

const initialUI = (): AppState["U"] => ({
  member: null, screen: "profiles", pinFor: null, pin: "", pinErr: false, toast: null,
  celebrate: null, timerEnd: null, ptab: "approve", judgeFor: "bo", sticker: {},
});

type Draft = AppState;

const toast = (d: Draft, msg: string) => {
  d.U.toast = { msg, id: Date.now() + Math.random() };
};
const addCoins = (S: Data, k: string, n: number) => {
  S.coins[k] = (S.coins[k] || 0) + n;
  S.week[k] = (S.week[k] || 0) + n;
};

function startKid(d: Draft, id: string) {
  const { S, U } = d;
  U.member = id;
  U.timerEnd = Date.now() + S.settings.minutes * 60000;
  if (S.settings.enforce && !inWindow(S)) {
    U.screen = "sleep";
    return;
  }
  U.screen = "home";
  const unseen = S.subs.filter((s) => s.member === id && s.status === "approved" && !s.seen);
  if (unseen.length) U.celebrate = { type: "coins", ids: unseen.map((s) => s.id) };
}

export type Actions = ReturnType<typeof makeActions>;

function makeActions(mutate: (fn: (d: Draft) => void) => void) {
  return {
    pick: (id: string) =>
      mutate((d) => {
        if (mem(d.S, id).role === "parent") {
          d.U.pinFor = id; d.U.pin = ""; d.U.pinErr = false;
        } else startKid(d, id);
      }),
    key: (digit: string) =>
      mutate((d) => {
        const { S, U } = d;
        if (U.pin.length >= 4) return;
        U.pin += digit; U.pinErr = false;
        if (U.pin.length === 4) {
          if (U.pin === S.settings.pin) {
            U.member = U.pinFor; U.pinFor = null; U.screen = "parent"; U.ptab = "approve"; U.timerEnd = null; U.pin = "";
            toast(d, "Chào " + mem(S, U.member!).name + "!");
          } else {
            U.pinErr = true; U.pin = "";
          }
        }
      }),
    del: () => mutate((d) => { d.U.pin = d.U.pin.slice(0, -1); }),
    pinClose: () => mutate((d) => { d.U.pinFor = null; d.U.pin = ""; d.U.pinErr = false; }),
    go: (s: AppState["U"]["screen"]) => {
      mutate((d) => { d.U.screen = s; });
      if (typeof window !== "undefined") window.scrollTo(0, 0);
    },
    logout: () =>
      mutate((d) => {
        d.U.member = null; d.U.screen = "profiles"; d.U.timerEnd = null; d.U.celebrate = null;
      }),
    timeout: () =>
      mutate((d) => {
        d.U.screen = "timeout"; d.U.timerEnd = null; d.U.celebrate = null;
      }),
    done: (tid: string) =>
      mutate((d) => {
        const { S, U } = d, k = U.member!, ex = subOf(S, k, tid);
        if (ex && ex.status === "redo") { ex.status = "pending"; ex.time = hhmm(); }
        else if (!ex) S.subs.push({ id: uid(), member: k, task: tid, date: today(), status: "pending", time: hhmm() });
        toast(d, "Đã gửi! Chờ bố mẹ gật đầu nhé");
      }),
    stick: (sid: string, i: number) => mutate((d) => { d.U.sticker[sid] = STICKERS[i]; }),
    approve: (sid: string) =>
      mutate((d) => {
        const { S, U } = d, s = S.subs.find((x) => x.id === sid);
        if (!s || s.status === "approved") return;
        const t = taskOf(S, s.task);
        s.status = "approved"; s.by = U.member!; s.sticker = U.sticker[sid] || STICKERS[0]; s.seen = false;
        addCoins(S, s.member, t.coins);
        partnersOf(S, t).forEach((pid) => addCoins(S, pid, t.coins));
        if (s.task === "t6")
          S.challenges.forEach((c) => {
            if ((c.a === s.member || c.b === s.member) && c.prog[s.member] < c.target) c.prog[s.member]++;
          });
        toast(d, t.who === "together"
          ? `Đã gật đầu! +${t.coins} Ủn cho ${mem(S, s.member).name} và ${partnerLabel(S, t)}`
          : `Đã gật đầu +${t.coins} Ủn cho ${mem(S, s.member).name}`);
      }),
    remind: (sid: string) =>
      mutate((d) => {
        const s = d.S.subs.find((x) => x.id === sid);
        if (s) s.status = "redo"; // Nhắc nhẹ: không trừ Ủn
        toast(d, "Đã nhắc con làm lại");
      }),
    redeem: (rid: string) =>
      mutate((d) => {
        const { S, U } = d, r = S.rewards.find((x) => x.id === rid), k = U.member!;
        if (!r) return;
        if (S.coins[k] < r.cost) { toast(d, `Còn thiếu ${r.cost - S.coins[k]} Ủn nữa!`); return; }
        S.coins[k] -= r.cost;
        S.promises.unshift({ id: uid(), member: k, reward: rid, status: "promised", at: "Bố mẹ sẽ hẹn ngày" });
        U.celebrate = { type: "redeem", title: r.title };
      }),
    give: () =>
      mutate((d) => {
        const { S, U } = d, k = U.member!;
        if (S.coins[k] < 20) { toast(d, "Chưa đủ 20 Ủn"); return; }
        S.coins[k] -= 20;
        S.jar.contrib[k] = (S.jar.contrib[k] || 0) + 20;
        if (jarTotal(S) >= S.jar.target) U.celebrate = { type: "jar" };
        else toast(d, "Đã góp 20 Ủn vào hũ!");
      }),
    judgeFor: (v: string) => mutate((d) => { d.U.judgeFor = v; }),
    judge: (tid: string) =>
      mutate((d) => {
        const { S, U } = d, p = U.judgeFor, ex = subOf(S, p, tid), t = taskOf(S, tid);
        if (ex && ex.status === "approved") {
          S.subs = S.subs.filter((s) => s.id !== ex.id);
          addCoins(S, p, -t.coins);
        } else {
          S.subs.push({ id: uid(), member: p, task: tid, date: today(), status: "approved", time: hhmm(), by: U.member!, seen: true });
          addCoins(S, p, t.coins);
        }
      }),
    closeCelebrate: () =>
      mutate((d) => {
        const c = d.U.celebrate;
        if (c && c.type === "coins") d.S.subs.forEach((s) => { if (c.ids.includes(s.id)) s.seen = true; });
        d.U.celebrate = null;
      }),
    ptab: (v: ParentTab) => mutate((d) => { d.U.ptab = v; }),
    promiseDone: (id: string) =>
      mutate((d) => {
        const p = d.S.promises.find((x) => x.id === id);
        if (p) p.status = "done";
        toast(d, "Tuyệt! Đã giữ lời hứa");
      }),
    delTask: (id: string) => mutate((d) => { d.S.tasks = d.S.tasks.filter((t) => t.id !== id); toast(d, "Đã xoá việc tốt"); }),
    delReward: (id: string) => mutate((d) => { d.S.rewards = d.S.rewards.filter((r) => r.id !== id); toast(d, "Đã xoá phiếu"); }),
    chal: (cid: string, who: string) =>
      mutate((d) => {
        const c = d.S.challenges.find((x) => x.id === cid);
        if (c && c.prog[who] < c.target) c.prog[who]++;
      }),
    delChal: (id: string) => mutate((d) => { d.S.challenges = d.S.challenges.filter((c) => c.id !== id); }),

    /* ---- form ---- */
    addTask: (v: { title: string; coins: number; slot: Slot; who: Who; icon: IconName }) =>
      mutate((d) => {
        const title = v.title.trim();
        if (!title) return;
        d.S.tasks.push({
          id: uid(), title, coins: Math.max(1, v.coins || 1), slot: v.slot, who: v.who,
          partner: "all", icon: v.icon, bg: BGS[d.S.tasks.length % BGS.length],
        });
        toast(d, "Đã thêm việc tốt");
      }),
    addReward: (v: { title: string; cost: number; tier: Tier; icon: IconName }) =>
      mutate((d) => {
        const title = v.title.trim();
        if (!title) return;
        d.S.rewards.push({ id: uid(), title, cost: Math.max(1, v.cost || 1), tier: v.tier, icon: v.icon, bg: BGS[d.S.rewards.length % BGS.length] });
        toast(d, "Đã thêm phiếu");
      }),
    addChal: (v: { a: string; b: string; title: string; target: number; prize: string }) =>
      mutate((d) => {
        const title = v.title.trim();
        if (!title || v.a === v.b) { toast(d, "Chọn 2 người khác nhau và đặt tên thử thách"); return; }
        d.S.challenges.push({
          id: uid(), a: v.a, b: v.b, title, target: Math.max(1, v.target || 5), prog: { [v.a]: 0, [v.b]: 0 },
          prize: v.prize.trim() || "Người thắng được chọn hoạt động cuối tuần", daysLeft: 7,
        });
        toast(d, "Đã lên kèo");
      }),
    saveSettings: (v: { pin: string; start: string; end: string; minutes: number; enforce: boolean; goal: string; target: number }) =>
      mutate((d) => {
        const pin = v.pin.trim();
        if (!/^\d{4}$/.test(pin)) { toast(d, "PIN phải gồm 4 chữ số"); return; }
        Object.assign(d.S.settings, { pin, start: v.start, end: v.end, minutes: Math.min(60, Math.max(1, v.minutes || 10)), enforce: v.enforce });
        d.S.jar.goal = v.goal.trim() || d.S.jar.goal;
        d.S.jar.target = Math.max(50, v.target || d.S.jar.target);
        toast(d, "Đã lưu cài đặt");
      }),
  };
}

type Ctx = { S: Data; U: AppState["U"]; A: Actions };
const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({ S: seedData(), U: initialUI() }));

  const mutate = useCallback((fn: (d: Draft) => void) => {
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const A = useMemo(() => makeActions(mutate), [mutate]);

  // Toast tự tắt sau 2,2 giây
  const toastId = state.U.toast?.id;
  useEffect(() => {
    if (toastId == null) return;
    const t = setTimeout(() => mutate((d) => { if (d.U.toast?.id === toastId) d.U.toast = null; }), 2200);
    return () => clearTimeout(t);
  }, [toastId, mutate]);

  const value = useMemo(() => ({ S: state.S, U: state.U, A }), [state, A]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp phải nằm trong AppProvider");
  return ctx;
}

export type { Role };
export { kidTasks };
