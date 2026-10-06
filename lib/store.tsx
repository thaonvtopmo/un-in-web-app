"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Backend, ChallengeInput, MemberEdit, NewChallenge, NewMember, NewTask, NotifyKind, PlanItem, PushSub, RewardInput, SettingsInput, TaskInput } from "./backend";
import { STICKERS, dowIdx, jarTotal, mem, partnerLabel, taskOf, taskOnDay } from "./data";
import { POTS, ruleWater, speciesOf } from "./garden";
import { forget, recall, remember, touchParent } from "./remember";
import type { Take } from "./recorder";
import { ruleSelfToggle, rulePlan, ruleApprove, ruleCancelPromise, ruleGive, ruleJudge, ruleRedeem, ruleRemind, ruleRevoke, ruleSubmit } from "./rules";
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
  celebrate: null, timerEnd: null, ptab: "approve", judgeFor, sticker: {}, gtab: "garden",
});

const toast = (d: Draft, msg: string) => {
  d.U.toast = { msg, id: Date.now() + Math.random() };
};

const KID_SCREENS: Screen[] = ["home", "missions", "arena", "garden", "shop", "jar", "judge", "summary"];
const isTmp = (id: string) => id.startsWith("tmp-");

/** Đổi mã lỗi của server thành câu dễ hiểu */
export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m.includes("mic_denied")) return "Chưa mở được micro. Cho phép dùng micro cho trang này trong cài đặt trình duyệt rồi thử lại nhé";
  if (m.includes("mic_unsupported")) return "Máy này chưa ghi âm được trên trình duyệt. Thử Safari hoặc Chrome bản mới";
  if (m.includes("audio_too_big")) return "File ghi âm quá lớn, ghi ngắn hơn nhé";
  if (m.includes("audio_upload_failed") || m.includes("invalid_audio")) return "Chưa tải được lời ghi âm lên, kiểm tra mạng rồi thử lại nhé";
  if (m.includes("outside_window")) return "Ủn đang ngủ, chưa tới giờ chơi nhé";
  if (m.includes("time_up")) return "Hết giờ chơi rồi, mai gặp lại nhé";
  if (m.includes("insufficient")) return "Chưa đủ Ủn rồi";
  if (m.includes("weekly_cap")) return "Tuần này con đã chi đủ cho khu vườn rồi, chờ tuần sau nhé";
  if (m.includes("no_water")) return "Hết nước rồi, làm thêm việc tốt để có nước nhé";
  if (m.includes("ready_to_harvest")) return "Cây hái được rồi, hái trước nhé";
  if (m.includes("not_ready")) return "Cây chưa đủ nước để hái, tưới thêm nhé";
  if (m.includes("slot_taken")) return "Ô này đã có cây rồi";
  if (m.includes("invalid_slot")) return "Ô này chưa mở";
  if (m.includes("max_slots")) return "Vườn đã mở hết các ô rồi";
  if (m.includes("already_owned")) return "Con đã có món này rồi";
  if (m.includes("not_owned")) return "Con chưa mua món này";
  if (m.includes("no_garden")) return "Con bắt đầu trồng vườn trước nhé";
  if (m.includes("garden_off")) return "Bố mẹ đang tắt khu vườn";
  if (m.includes("jar_closed")) return "Hũ đã đầy, chờ bố mẹ đặt mục tiêu mới nhé";
  if (m.includes("self_review")) return "Không tự gật đầu cho mình được";
  if (m.includes("wrong_pin")) return "PIN hiện tại chưa đúng";
  if (m.includes("pin_locked")) return "Nhập sai nhiều lần, thử lại sau 5 phút";
  if (m.includes("not_assigned")) return "Mục này không phải của người đó";
  if (m.includes("not_scheduled")) return "Việc này hôm nay chưa được giao";
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
          if (m.includes("mic_denied")) return "Chưa mở được micro. Cho phép dùng micro cho trang này trong cài đặt trình duyệt rồi thử lại nhé";
  if (m.includes("mic_unsupported")) return "Máy này chưa ghi âm được trên trình duyệt. Thử Safari hoặc Chrome bản mới";
  if (m.includes("audio_too_big")) return "File ghi âm quá lớn, ghi ngắn hơn nhé";
  if (m.includes("audio_upload_failed") || m.includes("invalid_audio")) return "Chưa tải được lời ghi âm lên, kiểm tra mạng rồi thử lại nhé";
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
      remember(id, "kid");
      mutate((d) => {
        d.S = S;
        d.U.member = id;
        if (!ss.inWindow) { d.U.screen = "sleep"; return; }
        if (ss.remaining !== null && ss.remaining <= 0) { d.U.screen = "timeout"; return; }
        d.U.screen = "home";
        d.U.timerEnd = ss.remaining === null ? null : Date.now() + ss.remaining * 1000; // null: bố mẹ đang tắt giới hạn phút
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
    logout: () => { forget(); mutate((d) => { d.U.member = null; d.U.screen = "profiles"; d.U.timerEnd = null; d.U.celebrate = null; }); },
    /** Mở lại app: nhớ bé hoặc bố/mẹ đã chọn trên máy này nên không phải chọn người và nhập PIN lại */
    async restore() {
      const r = recall();
      if (!r) return;
      const m = get().S.members.find((x) => x.id === r.member);
      if (!m || m.role !== r.role) { forget(); return; }
      if (r.role === "kid") { await startKid(m.id); return; }
      mutate((d) => { d.U.member = m.id; d.U.screen = "parent"; d.U.ptab = "approve"; d.U.timerEnd = null; });
      touchParent();
    },
    timeout: () => mutate((d) => { d.U.screen = "timeout"; d.U.timerEnd = null; d.U.celebrate = null; }),
    stick: (sid: string, i: number) => mutate((d) => { d.U.sticker[sid] = STICKERS[i]; }),
    judgeFor: (v: string) => mutate((d) => { d.U.judgeFor = v; }),
    ptab: (v: ParentTab) => mutate((d) => { d.U.ptab = v; }),
    toast: (msg: string) => mutate((d) => toast(d, msg)),
    gtab: (v: "garden" | "shop" | "race") => mutate((d) => { d.U.gtab = v; }),

    /* ---- khu vườn ---- */
    startGarden() {
      const k = get().U.member!;
      return run(() => backend.startGarden(k), "Khu vườn của con đã sẵn sàng!");
    },
    buySeed(species: string, slot: number) {
      const k = get().U.member!;
      const sp = speciesOf(species);
      return run(() => backend.buySeed(k, species, slot), `Đã trồng ${sp.name}!`);
    },
    buySlot() {
      const k = get().U.member!;
      return run(() => backend.buySlot(k), "Đã mở thêm một ô đất!");
    },
    buyPot(item: string) {
      const k = get().U.member!;
      const pot = POTS.find((p) => p.id === item);
      return run(() => backend.buyPot(k, item), `Đã mua ${pot?.name ?? "chậu"}!`);
    },
    setPot: (plant: string, item: string) => run(() => backend.setPot(plant, item), "Đã đổi chậu", (S) => { const p = Object.values(S.gardens).flatMap((g) => g.plants).find((x) => x.id === plant); if (p) p.pot = item as typeof p.pot; }),
    /** Tưới cây: giao diện cập nhật ngay, server đối chiếu sau */
    water(plant: string, amount: number) {
      return run(() => backend.waterPlant(plant, amount), undefined, (S) => { try { ruleWater(S, plant, amount); } catch { /* server sẽ báo lỗi nếu có */ } });
    },
    async harvest(plant: string) {
      const p = Object.values(get().S.gardens).flatMap((g) => g.plants).find((x) => x.id === plant);
      if (!p) return false;
      const sp = speciesOf(p.species);
      let amount = sp.fruit;
      const ok = await run(async () => { amount = await backend.harvestPlant(plant); });
      if (ok) mutate((d) => { d.U.celebrate = { type: "harvest", title: sp.name, amount, golden: sp.golden }; });
      return ok;
    },
    saveGardenSettings(enabled: boolean, cap: number) {
      const c = Math.min(5000, Math.max(0, Math.round(cap || 0)));
      return run(() => backend.saveGardenSettings(enabled, c), "Đã lưu cài đặt khu vườn", (S) => { S.settings.gardenEnabled = enabled; S.settings.gardenCap = c; });
    },

    /** Heartbeat 30 giây: cộng thời gian đã chơi ở server, hết phút hoặc ngoài giờ thì dừng */
    async heartbeat() {
      const k = get().U.member;
      if (!k) return;
      try {
        const [remaining, ss] = await Promise.all([backend.heartbeat(k, 30), backend.kidSession(k)]);
        mutate((d) => {
          if (!ss.inWindow) { d.U.screen = "sleep"; d.U.timerEnd = null; d.U.celebrate = null; }
          else if (remaining === -1) d.U.timerEnd = null; // không giới hạn phút
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
    async give(amount = 20) {
      const { S, U } = get();
      const k = U.member!;
      if (S.jar.reached) return bad("Hũ đã đầy, chờ bố mẹ đặt mục tiêu mới nhé");
      if (!(amount >= 1)) return false;
      if (S.coins[k] < amount) return bad(`Chưa đủ ${amount} Ủn`);
      let reached = false;
      const ok = await run(async () => { reached = await backend.contributeJar(k, S.jar.id, amount); }, undefined, (D) => { ruleGive(D, k, amount); });
      if (ok) mutate((d) => { if (reached) d.U.celebrate = { type: "jar" }; else toast(d, `Đã góp ${amount} Ủn vào hũ!`); });
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
      if (!v.selfCheck && !(v.coins >= 1 && v.coins <= 200)) return Promise.resolve(bad("Số Ủn phải từ 1 đến 200"));
      return run(() => backend.addTask({ ...v, title, coins: v.selfCheck ? 0 : v.coins }), "Đã thêm việc tốt");
    },
    updateTask(id: string, v: TaskInput) {
      const title = v.title.trim();
      if (!title) return Promise.resolve(bad("Nhập tên việc tốt nhé"));
      if (!v.selfCheck && !(v.coins >= 1 && v.coins <= 200)) return Promise.resolve(bad("Số Ủn phải từ 1 đến 200"));
      return run(() => backend.updateTask(id, { ...v, title, coins: v.selfCheck ? 0 : v.coins }), "Đã lưu việc tốt");
    },
    delTask: (id: string) => run(() => backend.removeTask(id), "Đã xoá việc tốt", (S) => { S.tasks = S.tasks.filter((t) => t.id !== id); }),

    /* ---- kế hoạch theo ngày ---- */
    plan(day: string, items: PlanItem[], okMsg?: string) {
      return run(() => backend.setDayPlan(day, items), okMsg, (S) => rulePlan(S, day, items));
    },
    /** Bật hoặc tắt một việc cho một ngày; nếu kết quả trùng lịch lặp thì bỏ ghi đè cho gọn */
    togglePlan(day: string, taskId: string, enabled: boolean) {
      const t = get().S.tasks.find((x) => x.id === taskId);
      if (!t) return Promise.resolve(false);
      const byRepeat = ((t.repeat >> dowIdx(day)) & 1) === 1;
      return run(() => backend.setDayPlan(day, [{ task: taskId, enabled: enabled === byRepeat ? null : enabled }]), undefined, (S) => rulePlan(S, day, [{ task: taskId, enabled: enabled === byRepeat ? null : enabled }]));
    },
    /** Lấy kế hoạch của ngày `from` áp cho ngày `to` */
    copyPlan(from: string, to: string) {
      const { S } = get();
      const items: PlanItem[] = S.tasks.map((t) => {
        const on = taskOnDay(S, t, from);
        const byRepeat = ((t.repeat >> dowIdx(to)) & 1) === 1;
        return { task: t.id, enabled: on === byRepeat ? null : on };
      });
      return run(() => backend.setDayPlan(to, items), "Đã lấy kế hoạch của ngày trước", (D) => rulePlan(D, to, items));
    },
    setAllPlan(day: string, on: boolean) {
      const { S } = get();
      const items: PlanItem[] = S.tasks.map((t) => {
        const byRepeat = ((t.repeat >> dowIdx(day)) & 1) === 1;
        return { task: t.id, enabled: on === byRepeat ? null : on };
      });
      return run(() => backend.setDayPlan(day, items), undefined, (D) => rulePlan(D, day, items));
    },
    /** Thêm việc cho một ngày. keep = true: lưu vào kho việc (lặp theo v.repeat); false: chỉ làm một lần. */
    addTaskForDay(v: NewTask, day: string, keep = false) {
      const title = v.title.trim();
      if (!title) return Promise.resolve(bad("Nhập tên việc nhé"));
      if (!v.selfCheck && !(v.coins >= 1 && v.coins <= 200)) return Promise.resolve(bad("Số Ủn phải từ 1 đến 200"));
      return run(() => backend.addTaskForDay({ ...v, title, coins: v.selfCheck ? 0 : v.coins }, day, keep), keep ? "Đã thêm vào kho việc và ngày này" : "Đã thêm việc cho ngày này");
    },
    /** Bố/mẹ tự đánh dấu xong hoặc bỏ đánh dấu một việc riêng */
    selfToggle(taskId: string) {
      const me = get().U.member!;
      return run(() => backend.toggleSelfTask(me, taskId), undefined, (S) => ruleSelfToggle(S, me, taskId));
    },

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
    delChal: (id: string) => run(() => backend.removeChallenge(id), "Đã xoá kèo", (S) => { S.challenges = S.challenges.filter((c) => c.id !== id); }),

    /* ---- thành viên ---- */
    addMember(v: NewMember) {
      const name = v.name.trim();
      if (!name) return Promise.resolve(bad("Nhập tên thành viên nhé"));
      return run(() => backend.addMember({ name, role: v.role }), `Đã thêm ${name}`);
    },
    updateMember(id: string, v: MemberEdit) {
      const name = v.name.trim();
      if (!name) return Promise.resolve(bad("Nhập tên thành viên nhé"));
      return run(() => backend.updateMember(id, { name, color: v.color, avatar: v.avatar }), "Đã lưu thành viên", (S) => {
        const m = S.members.find((x) => x.id === id);
        if (m) { m.name = name; m.color = v.color; m.soft = `${v.color}33`; m.avatar = v.avatar || undefined; }
      });
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
    reviewRange: (from: string, to: string) => backend.reviewRange(from, to),
    tts: (req: { praise?: string; text?: string; voice: "f" | "m" }) => backend.tts(req),

    /* ---- lời khen của bố mẹ ---- */
    sendPraise(to: string, body: string, voice: "f" | "m" = "f", audio?: Take) {
      const text = body.trim();
      if (!text && !audio) return Promise.resolve(bad("Viết vài lời khen hoặc ghi âm trước nhé"));
      const from = get().U.member!;
      return run(() => backend.sendPraise(from, to, text, voice, audio), "Đã gửi lời khen! Con sẽ nghe khi vào chơi");
    },
    praiseAudio: (path: string) => backend.praiseAudio(path),
    markPraiseHeard: (id: string) => run(() => backend.markPraiseHeard(id), undefined, (S) => { const p = S.praises.find((x) => x.id === id); if (p) p.heard = true; }),
    deletePraise: (id: string) => run(() => backend.deletePraise(id), "Đã xoá lời khen", (S) => { S.praises = S.praises.filter((p) => p.id !== id); }),
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

  // Mở lại app: vào thẳng người đã chọn lần trước (nếu còn được nhớ), và gia hạn thời gian nhớ khi bố/mẹ còn đang dùng
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    void A.restore();
    let last = 0;
    const touch = () => { const n = Date.now(); if (n - last > 30_000) { last = n; touchParent(); } };
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    return () => { window.removeEventListener("pointerdown", touch); window.removeEventListener("keydown", touch); };
  }, [A]);

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
            remember(d.U.pinFor, "parent");
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
