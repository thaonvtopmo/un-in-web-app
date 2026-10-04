"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Backend, ChallengeInput, NewChallenge, NewMember, NewTask, NotifyKind, PushSub, RewardInput, SettingsInput, TaskInput } from "./backend";
import { STICKERS, jarTotal, mem, partnerLabel, taskOf } from "./data";
import { ruleApprove, ruleCancelPromise, ruleGive, ruleJudge, ruleRedeem, ruleRemind, ruleRevoke, ruleSubmit } from "./rules";
import type { AppState, Data, ParentTab, Screen } from "./types";

/**
 * Store của app. Dữ liệu (Data) luôn do server là nguồn sự thật:
 * mỗi thao tác chạy trên giao diện ngay (cho cảm giác tức thì), gọi hàm server,
 * rồi tải lại dữ liệu thật để đối chiếu. Nếu server từ chối thì giao diện quay về đúng trạng thái.
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
const isTmp = (id: string) => id.startsWith("tmp-");

/** Đổi mã lỗi của server thành câu dễ hiểu */
export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m.includes("outside_window")) return "Ủn đang ngủ, chưa tới giờ chơi nhé";
  if (m.includes("time_up")) return "Hết giờ chơi rồi, mai gặp lại nhé";
  if (m.includes("insufficient")) return "Chưa đủ Ủn rồi";
  if (m.includes("jar_closed")) return "Hũ đã đầy, chờ bố mẹ đặt mục tiêu mới nhé";
  if (m.includes("self_review")) return "Không tự gật đầu cho mình được";
  if (m.includes("wrong_pin")) return "PIN hiện tại chưa đúng";
  if (m.includes("pin_locked")) return "Nhập sai nhiều lần, thử lại sau 5 phút";
  if (m.includes("not_assigned")) return "Mục này không phải của người đó";
  if (m.includes("balance_negative")) return "Con đã tiêu số Ủn này rồi nên chưa hoàn tác được";
  if (m.includes("too_late")) return "Chỉ hoàn tác được trong ngày";
  if (m.includes("not_promised") || m.includes("not_approved")) return "Việc này đã được xử lý rồi";
  if (m.includes("check constraint")) return "Giá trị chưa hợp lệ, kiểm tra lại số Ủn nhé";
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
  /**
   * Chạy một thao tác: cập nhật giao diện ngay (nếu có `optimistic`), gọi server, tải lại dữ liệu thật.
   * Trả về true nếu thành công. Khi lỗi: báo lỗi và tải lại để bỏ phần đã cập nhật tạm.
   */
  async function run(fn: () => Promise<unknown>, okMsg?: string, optimistic?: (S: Data) => void): Promise<boolean> {
    if (optimistic) mutate((d) => { optimistic(d.S); if (okMsg) toast(d, okMsg); }); // báo ngay, không chờ server
    try {
      await fn();
      void reload(); // đối chiếu với dữ liệu thật ở chế độ nền, không bắt người dùng chờ
      if (okMsg && !optimistic) mutate((d) => toast(d, okMsg));
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
      await reload();
      return false;
    }
  }
  const bad = (msg: string) => { mutate((d) => toast(d, msg)); return false; };

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
    toast: (msg: string) => mutate((d) => toast(d, msg)),

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

    /* ---- luồng chính của con ---- */
    done: (tid: string) => {
      const k = get().U.member!;
      return run(async () => { await backend.submitTask(k, tid); void backend.notify("pending"); }, "Đã gửi! Chờ bố mẹ gật đầu nhé", (S) => ruleSubmit(S, k, tid));
    },
    async redeem(rid: string) {
      const { S, U } = get();
      const r = S.rewards.find((x) => x.id === rid);
      if (!r) return false;
      const k = U.member!;
      if (S.coins[k] < r.cost) return bad(`Còn thiếu ${r.cost - S.coins[k]} Ủn nữa!`);
      const ok = await run(async () => { await backend.redeem(k, rid); void backend.notify("redeem"); }, undefined, (D) => ruleRedeem(D, k, rid));
      if (ok) mutate((d) => { d.U.celebrate = { type: "redeem", title: r.title }; });
      return ok;
    },
    async give() {
      const { S, U } = get();
      const k = U.member!;
      if (S.jar.reached) return bad("Hũ đã đầy, chờ bố mẹ đặt mục tiêu mới nhé");
      if (S.coins[k] < 20) return bad("Chưa đủ 20 Ủn");
      let reached = false;
      const ok = await run(async () => { reached = await backend.contributeJar(k, S.jar.id, 20); }, undefined, (D) => { ruleGive(D, k, 20); });
      if (ok) mutate((d) => { if (reached) d.U.celebrate = { type: "jar" }; else toast(d, "Đã góp 20 Ủn vào hũ!"); });
      return ok;
    },
    judge(tid: string) {
      const { U } = get();
      const parent = U.judgeFor, kid = U.member!;
      return run(() => backend.judge(parent, tid, kid), undefined, (S) => ruleJudge(S, parent, tid, kid));
    },
    closeCelebrate() {
      const c = get().U.celebrate;
      mutate((d) => { d.U.celebrate = null; });
      if (c && c.type === "coins") void run(() => backend.markSeen(c.ids), undefined, (S) => { S.subs.forEach((s) => { if (c.ids.includes(s.id)) s.seen = true; }); });
    },

    /* ---- duyệt của bố mẹ ---- */
    approve(sid: string) {
      const { S, U } = get();
      const s = S.subs.find((x) => x.id === sid);
      if (!s || isTmp(sid)) return Promise.resolve(false);
      const t = taskOf(S, s.task);
      const msg = t.who === "together"
        ? `Đã gật đầu! +${t.coins} Ủn cho ${mem(S, s.member).name} và ${partnerLabel(S, t)}`
        : `Đã gật đầu +${t.coins} Ủn cho ${mem(S, s.member).name}`;
      const sticker = U.sticker[sid] || STICKERS[0], reviewer = U.member!;
      return run(() => backend.approve(sid, reviewer, sticker), msg, (D) => ruleApprove(D, sid, reviewer, sticker));
    },
    revoke(sid: string) {
      if (isTmp(sid)) return Promise.resolve(false);
      return run(() => backend.revokeApproval(sid), "Đã hoàn tác, việc quay lại chờ gật đầu", (S) => ruleRevoke(S, sid));
    },
    remind(sid: string) {
      if (isTmp(sid)) return Promise.resolve(false);
      return run(() => backend.remind(sid), "Đã nhắc con làm lại", (S) => ruleRemind(S, sid));
    },

    /* ---- ngoéo tay ---- */
    promiseDone: (id: string) => run(() => backend.completePromise(id), "Tuyệt! Đã giữ lời hứa", (S) => { const p = S.promises.find((x) => x.id === id); if (p) p.status = "done"; }),
    cancelPromise: (id: string) => run(() => backend.cancelPromise(id), "Đã huỷ phiếu và hoàn Ủn cho con", (S) => ruleCancelPromise(S, id)),
    setPromiseNote: (id: string, note: string) => run(() => backend.setPromiseNote(id, note), "Đã lưu ngày hẹn", (S) => { const p = S.promises.find((x) => x.id === id); if (p) p.at = note.trim() || "Bố mẹ sẽ hẹn ngày"; }),

    /* ---- việc tốt / checklist ---- */
    addTask(v: NewTask) {
      const title = v.title.trim();
      if (!title) return Promise.resolve(bad("Nhập tên việc tốt nhé"));
      if (!(v.coins >= 1 && v.coins <= 200)) return Promise.resolve(bad("Số Ủn phải từ 1 đến 200"));
      return run(() => backend.addTask({ ...v, title }), "Đã thêm việc tốt");
    },
    updateTask(id: string, v: TaskInput) {
      const title = v.title.trim();
      if (!title) return Promise.resolve(bad("Nhập tên việc tốt nhé"));
      if (!(v.coins >= 1 && v.coins <= 200)) return Promise.resolve(bad("Số Ủn phải từ 1 đến 200"));
      return run(() => backend.updateTask(id, { ...v, title }), "Đã lưu việc tốt");
    },
    delTask: (id: string) => run(() => backend.removeTask(id), "Đã xoá việc tốt", (S) => { S.tasks = S.tasks.filter((t) => t.id !== id); }),

    /* ---- phiếu đi chơi ---- */
    addReward(v: RewardInput) {
      const title = v.title.trim();
      if (!title) return Promise.resolve(bad("Nhập tên phiếu nhé"));
      if (!(v.cost >= 1)) return Promise.resolve(bad("Giá phiếu phải lớn hơn 0"));
      return run(() => backend.addReward({ ...v, title }), "Đã thêm phiếu");
    },
    updateReward(id: string, v: RewardInput) {
      const title = v.title.trim();
      if (!title) return Promise.resolve(bad("Nhập tên phiếu nhé"));
      if (!(v.cost >= 1)) return Promise.resolve(bad("Giá phiếu phải lớn hơn 0"));
      return run(() => backend.updateReward(id, { ...v, title }), "Đã lưu phiếu");
    },
    delReward: (id: string) => run(() => backend.removeReward(id), "Đã xoá phiếu", (S) => { S.rewards = S.rewards.filter((r) => r.id !== id); }),

    /* ---- kèo cả nhà ---- */
    addChal(v: NewChallenge) {
      const title = v.title.trim();
      if (!title || v.a === v.b) return Promise.resolve(bad("Chọn 2 người khác nhau và đặt tên thử thách"));
      const target = Math.min(14, Math.max(1, v.target || 5));
      return run(() => backend.addChallenge({ ...v, title, target, prize: v.prize.trim() || "Người thắng được chọn hoạt động cuối tuần" }), "Đã lên kèo");
    },
    updateChal(id: string, v: ChallengeInput) {
      const title = v.title.trim();
      if (!title) return Promise.resolve(bad("Nhập tên thử thách nhé"));
      const target = Math.min(14, Math.max(1, v.target || 5));
      return run(() => backend.updateChallenge(id, { ...v, title, target, prize: v.prize.trim() }), "Đã lưu kèo");
    },
    chal: (cid: string, who: string, delta: 1 | -1) =>
      run(() => backend.bumpChallenge(cid, who, delta), undefined, (S) => {
        const c = S.challenges.find((x) => x.id === cid);
        if (c && who in c.prog) c.prog[who] = Math.min(c.target, Math.max(0, c.prog[who] + delta));
      }),
    delChal: (id: string) => run(() => backend.removeChallenge(id), "Đã kết thúc kèo", (S) => { S.challenges = S.challenges.filter((c) => c.id !== id); }),

    /* ---- thành viên ---- */
    addMember(v: NewMember) {
      const name = v.name.trim();
      if (!name) return Promise.resolve(bad("Nhập tên thành viên nhé"));
      return run(() => backend.addMember({ name, role: v.role }), `Đã thêm ${name}`);
    },
    updateMember(id: string, v: { name: string; color: string }) {
      const name = v.name.trim();
      if (!name) return Promise.resolve(bad("Nhập tên thành viên nhé"));
      return run(() => backend.updateMember(id, { name, color: v.color }), "Đã lưu thành viên");
    },
    removeMember: (id: string) => run(() => backend.removeMember(id), "Đã xoá thành viên"),

    /* ---- cài đặt ---- */
    async saveSettings(v: SettingsInput & { goal: string; target: number }) {
      const { S } = get();
      const newPin = (v.newPin ?? "").trim();
      if (newPin && !/^\d{4}$/.test(newPin)) return bad("PIN mới phải gồm 4 chữ số");
      if (v.start >= v.end) return bad("Giờ kết thúc phải sau giờ bắt đầu");
      const minutes = Math.min(60, Math.max(1, v.minutes || 10));
      const goal = v.goal.trim() || S.jar.goal;
      const target = Math.max(50, v.target || S.jar.target);
      return run(async () => {
        await backend.saveSettings({ ...v, minutes, newPin: newPin || undefined, oldPin: (v.oldPin ?? "").trim() });
        if (goal !== S.jar.goal || target !== S.jar.target) await backend.setJarGoal(goal, target);
      }, newPin ? "Đã lưu cài đặt và đổi PIN" : "Đã lưu cài đặt");
    },

    pushSubscribe: (sub: PushSub, label: string) => backend.pushSubscribe(sub, label),
    pushUnsubscribe: (endpoint: string) => backend.pushUnsubscribe(endpoint),
    notify: (kind: NotifyKind) => backend.notify(kind),

    leaderboard: () => backend.leaderboard(),
    weekReport: (offset: number) => backend.weekReport(offset),
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

/** Tải dữ liệu từ server; nếu đang tải mà có yêu cầu mới thì chỉ tải thêm đúng một lần nữa sau đó */
function createReloader(backend: Backend, store: ReturnType<typeof createStore>) {
  let inflight: Promise<void> | null = null;
  let again = false;
  return function reload(): Promise<void> {
    if (inflight) { again = true; return inflight; }
    inflight = (async () => {
      do {
        again = false;
        try {
          const S = await backend.load();
          store.update((p) => ({ ...p, S }));
        } catch { /* giữ dữ liệu cũ nếu tải lỗi */ }
      } while (again);
    })().finally(() => { inflight = null; });
    return inflight;
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

  // Gộp các lần tải chồng nhau (thao tác + sự kiện realtime) thành một lần tải tiếp theo
  const [reload] = useState(() => createReloader(backend, store));

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
