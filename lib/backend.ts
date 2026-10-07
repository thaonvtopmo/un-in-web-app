import type { IconName } from "@/components/Icon";
import { ICON_PATHS } from "@/components/Icon";
import { BGS, addDays, hhmmOf, today } from "./data";
import { getSupabase } from "./supabase";
import type { DaySummary } from "./review";
import { baseMime, extOf, type Take } from "./recorder";
import type { Alarm, Challenge, Data, Garden, Member, Praise, Reward, Role, Settings, Slot, Submission, Task, Tier, Who } from "./types";

/**
 * Lớp nói chuyện với server. Giao diện chỉ biết interface này:
 * chế độ dùng thử (demo.ts) và chế độ Supabase dùng chung một giao diện.
 * Mọi thao tác ghi Ủn đều đi qua hàm trên server (xem supabase/migrations).
 */
export type NewMember = { name: string; role: Role };
/** remaining = null nghĩa là không giới hạn phút (bố mẹ đang tắt giới hạn) */
export type KidSession = { remaining: number | null; inWindow: boolean };
export type LeaderRow = { rank: number; name: string; weekCoins: number; members: number; avg: number; mine: boolean };
export type SettingsInput = {
  familyName: string; start: string; end: string; minutes: number; enforce: boolean; leaderboard: boolean; limitEnabled: boolean;
  oldPin?: string; newPin?: string;
};
export type TaskInput = { title: string; coins: number; slot: Slot; icon: IconName; who: Who; kids?: string[]; parents?: string[]; repeat: number; due?: string; est?: number; selfCheck?: boolean };
export type PlanItem = { task: string; enabled: boolean | null };
export type MemberEdit = { name: string; color: string; avatar?: string };
export type NewTask = TaskInput;
export type AlarmInput = Omit<Alarm, "id"> & { id?: string };
export type RewardInput = { title: string; cost: number; tier: Tier; icon: IconName };
export type ChallengeInput = { title: string; target: number; prize: string; linkedTask?: string };
export type NewChallenge = ChallengeInput & { a: string; b: string };
export type WeekRow = { member: string; day: string; earned: number; spent: number; tasks: number };
export type WeekReport = { start: string; days: string[]; rows: WeekRow[] };
export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
export type NotifyKind = "pending" | "redeem" | "test";

export interface Backend {
  load(): Promise<Data>;
  subscribe(onChange: () => void): () => void;
  verifyPin(pin: string): Promise<boolean>;
  kidSession(member: string): Promise<KidSession>;
  heartbeat(member: string, seconds: number): Promise<number>;
  submitTask(member: string, task: string): Promise<void>;
  approve(sub: string, reviewer: string, sticker: string): Promise<void>;
  revokeApproval(sub: string): Promise<void>;
  remind(sub: string): Promise<void>;
  judge(parent: string, task: string, kid: string): Promise<void>;
  markSeen(subs: string[]): Promise<void>;
  redeem(member: string, reward: string): Promise<void>;
  completePromise(id: string): Promise<void>;
  cancelPromise(id: string): Promise<void>;
  setPromiseNote(id: string, note: string): Promise<void>;
  contributeJar(member: string, goal: string, amount: number): Promise<boolean>;
  setJarGoal(title: string, target: number): Promise<void>;
  addTask(v: NewTask): Promise<void>;
  updateTask(id: string, v: TaskInput): Promise<void>;
  removeTask(id: string): Promise<void>;
  addReward(v: RewardInput): Promise<void>;
  updateReward(id: string, v: RewardInput): Promise<void>;
  removeReward(id: string): Promise<void>;
  addChallenge(v: NewChallenge): Promise<void>;
  updateChallenge(id: string, v: ChallengeInput): Promise<void>;
  bumpChallenge(id: string, who: string, delta: 1 | -1): Promise<void>;
  removeChallenge(id: string): Promise<void>;
  saveSettings(v: SettingsInput): Promise<void>;
  addMember(m: NewMember): Promise<void>;
  updateMember(id: string, v: MemberEdit): Promise<void>;
  /** Đặt kế hoạch cho một ngày (enabled = null: bỏ ghi đè, theo lịch lặp) */
  setDayPlan(day: string, items: PlanItem[]): Promise<void>;
  /** Thêm một việc chỉ cho đúng một ngày */
  addTaskForDay(v: NewTask, day: string, keep: boolean): Promise<void>;
  /** Bố/mẹ tự đánh dấu xong một việc riêng của mình */
  toggleSelfTask(parent: string, task: string): Promise<void>;
  removeMember(id: string): Promise<void>;
  leaderboard(): Promise<LeaderRow[]>;
  weekReport(offset: number): Promise<WeekReport>;
  /** Tổng kết từng người từng ngày trong khoảng [from, to] (Nhìn lại, sticker) */
  reviewRange(from: string, to: string): Promise<DaySummary[]>;
  /** Bố/mẹ gửi lời khen cho con */
  sendPraise(from: string, to: string, body: string, voice: "f" | "m", audio?: Take): Promise<void>;
  /** Tải file ghi âm của một lời khen; null nếu không tải được */
  praiseAudio(path: string): Promise<Blob | null>;
  /** Âm thanh giọng đọc tạo ở máy chủ (mp3); null nếu không có (bản dùng thử hoặc máy chủ lỗi) thì dùng giọng đọc của máy */
  tts(req: { praise?: string; text?: string; voice: "f" | "m" }): Promise<Blob | null>;
  markPraiseHeard(id: string): Promise<void>;
  /* Khu vườn */
  startGarden(member: string): Promise<void>;
  buySeed(member: string, species: string, slot: number): Promise<void>;
  buySlot(member: string): Promise<void>;
  buyPot(member: string, item: string): Promise<void>;
  /** Bán lại chậu, trả về số Ủn nhận lại */
  sellPot(member: string, item: string): Promise<number>;
  /* Báo thức */
  saveAlarm(a: AlarmInput, take?: Take, oldAudioPath?: string): Promise<void>;
  setAlarmEnabled(id: string, enabled: boolean): Promise<void>;
  deleteAlarm(id: string): Promise<void>;
  /** Bé bấm "Con dậy rồi!": dừng nhắc lại hôm nay */
  ackAlarm(id: string): Promise<void>;
  setPot(plant: string, item: string): Promise<void>;
  /** Trả về số giọt đã tưới thật */
  waterPlant(plant: string, amount: number): Promise<number>;
  /** Trả về số Ủn nhận được */
  harvestPlant(plant: string): Promise<number>;
  saveGardenSettings(enabled: boolean, weeklyCap: number): Promise<void>;
  deletePraise(id: string): Promise<void>;
  pushSubscribe(sub: PushSub, label: string): Promise<void>;
  pushUnsubscribe(endpoint: string): Promise<void>;
  /** Báo cho các thiết bị của bố mẹ (thông báo đẩy). Trả về số thiết bị đã gửi tới. */
  notify(kind: NotifyKind): Promise<number>;
}

/* ---------- Màu avatar ---------- */
export const PARENT_COLORS = ["#FFB27A", "#FF9CC2", "#FFD36B", "#9ED9FF"];
export const KID_COLORS = ["#3DD6B5", "#B9A6FF", "#FF8FB8", "#7FD1FF", "#FFC93C", "#FF8A3D"];

export const initialOf = (name: string, role: Role) => {
  const n = name.trim();
  return role === "parent" ? (n.length <= 2 ? n : n[0].toUpperCase()) : n[0].toUpperCase();
};

export function makeMember(id: string, m: NewMember, index: number): Member {
  const name = m.name.trim();
  const palette = m.role === "parent" ? PARENT_COLORS : KID_COLORS;
  const color = palette[index % palette.length];
  return {
    id, name, role: m.role, color,
    soft: `${color}33`,
    initial: initialOf(name, m.role),
    label: m.role === "kid" ? "Con" : undefined,
  };
}

const hashBg = (id: string) => BGS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % BGS.length];
const safeIcon = (i: string): IconName => (i in ICON_PATHS ? (i as IconName) : "star");

/* ---------- Chuỗi ngày (≥3 việc tốt được gật đầu mỗi ngày) ---------- */
export function streakOf(subs: Submission[], kid: string, todayYmd: string): number {
  const perDay = new Map<string, number>();
  for (const s of subs) if (s.member === kid && s.status === "approved") perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1);
  let day = (perDay.get(todayYmd) ?? 0) >= 3 ? todayYmd : addDays(todayYmd, -1); // hôm nay chưa đủ thì chưa mất chuỗi
  let n = 0;
  while ((perDay.get(day) ?? 0) >= 3) { n++; day = addDays(day, -1); }
  return n;
}

/** Thứ Hai của tuần (theo giờ Việt Nam) cách tuần này `offset` tuần */
export function weekStartOf(offset: number, todayYmd = today()): string {
  const dow = new Date(todayYmd + "T00:00:00Z").getUTCDay(); // 0 = Chủ nhật
  return addDays(todayYmd, -((dow + 6) % 7) + offset * 7);
}

/* ---------- Thông tin gia đình ---------- */
const hhmm = (t: string) => t.slice(0, 5);

export async function getFamilyId(): Promise<string | null> {
  const { data: d, error } = await getSupabase().from("families").select("id").maybeSingle();
  if (error) throw error;
  return d?.id ?? null;
}

export type FamilySetup = { name: string; pin: string; members: NewMember[]; start: string; end: string; minutes: number; enforce: boolean; limitEnabled: boolean; leaderboard: boolean };

export async function createFamily(v: FamilySetup) {
  const counts: Record<Role, number> = { parent: 0, kid: 0 };
  const payload = v.members.map((m) => {
    const mm = makeMember("", m, counts[m.role]++);
    return { name: mm.name, role: mm.role, color: mm.color, initial: mm.initial };
  });
  const { error } = await getSupabase().rpc("create_family", {
    p_name: v.name, p_pin: v.pin, p_members: payload,
    p_settings: { golden_start: v.start, golden_end: v.end, daily_minutes: v.minutes, enforce_golden: v.enforce, limit_enabled: v.limitEnabled, leaderboard_opt_in: v.leaderboard },
  });
  if (error) throw error;
}

/* ---------- Backend Supabase ---------- */
const ok = (r: { error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
};
const val = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function snapshotToData(j: any, t0: string): Data {
  const f = j.family;
  const members: Member[] = j.members.map((m: any) => ({
    id: m.id, name: m.name, role: m.role, color: m.color, soft: `${m.color}33`, initial: m.initial, avatar: m.avatar ?? undefined, label: m.role === "kid" ? "Con" : undefined,
  }));
  const submissions: Submission[] = j.submissions.map((s: any) => ({
    id: s.id, member: s.member_id, task: s.task_id, date: s.day, status: s.status, time: hhmmOf(new Date(s.submitted_at)),
    by: s.reviewer_id ?? undefined, sticker: s.sticker ?? undefined, seen: s.seen_by_member ?? false,
  }));
  const coins: Record<string, number> = {}, week: Record<string, number> = {}, lastWeek: Record<string, number> = {}, streak: Record<string, number> = {};
  for (const m of members) { coins[m.id] = 0; week[m.id] = 0; lastWeek[m.id] = 0; }
  for (const r of j.stats) { coins[r.member_id] = Number(r.balance); week[r.member_id] = Number(r.week_coins); lastWeek[r.member_id] = Number(r.last_week_coins); }
  for (const m of members) if (m.role === "kid") streak[m.id] = streakOf(submissions, m.id, t0);
  const tasks: Task[] = j.tasks.map((t: any) => ({
    id: t.id, title: t.title, icon: safeIcon(t.icon), coins: t.coins, slot: t.slot, who: t.audience,
    kids: t.kid_ids ?? undefined, parents: t.parent_ids ?? undefined, repeat: t.repeat_days ?? 127, bg: hashBg(t.id),
    due: t.due_time ?? undefined, est: t.est_minutes ?? undefined, selfCheck: t.self_check === true, oneOff: t.one_off === true,
  }));
  const overrides: Data["overrides"] = {};
  for (const o of j.overrides ?? []) (overrides[o.task_id] ??= {})[o.day] = o.enabled;
  const rewards: Reward[] = j.rewards.map((r: any) => ({ id: r.id, title: r.title, icon: safeIcon(r.icon), cost: r.cost, tier: r.tier, bg: hashBg(r.id) }));
  const goal = j.goals.find((g: any) => g.status === "active") ?? j.goals[0];
  const contrib: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
  if (goal) for (const [mid, v] of Object.entries(goal.contrib ?? {})) contrib[mid] = Number(v);
  const challenges: Challenge[] = j.challenges.map((c: any) => ({
    id: c.id, a: c.member_a, b: c.member_b, title: c.title, target: c.target,
    prog: { [c.member_a]: c.progress_a, [c.member_b]: c.progress_b }, prize: c.prize ?? "",
    daysLeft: Math.max(0, Math.round((Date.parse(c.ends_on) - Date.parse(t0)) / 86400000)), linkedTask: c.linked_task_id ?? undefined,
  }));
  const settings: Settings = { start: hhmm(f.golden_start), end: hhmm(f.golden_end), minutes: f.daily_minutes, enforce: f.enforce_golden, leaderboard: f.leaderboard_opt_in, limitEnabled: f.limit_enabled === true, gardenEnabled: f.garden_enabled !== false, gardenCap: f.garden_weekly_cap ?? 300 };
  const gardens: Record<string, Garden> = {};
  for (const g of j.gardens ?? []) {
    gardens[g.member_id] = {
      member: g.member_id, startedAt: g.started_at, slots: g.slots, earned: g.earned, spentWeek: g.spent_week,
      plants: (g.plants ?? []).map((p: any) => ({ id: p.id, species: p.species, slot: p.slot, watered: p.watered, poured: p.poured, harvests: p.harvests, pot: p.pot, lastWateredAt: p.last_watered_at, plantedAt: p.planted_at })),
      items: g.items ?? [],
    };
  }
  return {
    familyName: f.name === "Nhà mình" ? "" : f.name,
    members, overrides, coins, week, lastWeek, streak, tasks, subs: submissions, rewards,
    promises: j.redemptions.map((p: any) => ({ id: p.id, member: p.member_id, reward: p.reward_id, status: p.status === "done" ? "done" as const : "promised" as const, at: p.scheduled_note || "Bố mẹ sẽ hẹn ngày" })),
    jar: { id: goal?.id ?? "", goal: goal?.title ?? "Hũ Mơ Ước", target: goal?.target ?? 500, contrib, reached: goal?.status === "reached" },
    jarLog: (j.jar_log ?? []).filter((l: any) => l.goal_id === goal?.id).slice(0, 12).map((l: any) => ({ member: l.member_id, amount: Number(l.amount), at: l.at })),
    challenges, settings,
    gardens,
    alarms: (j.alarms ?? []).map((a: any): Alarm => ({
      id: a.id, title: a.title, at: a.at, repeat: a.repeat_days, kids: a.kid_ids ?? undefined, tone: a.tone, body: a.body ?? "", voice: a.voice === "m" ? "m" : "f",
      audio: a.audio_path ? { path: a.audio_path, secs: a.audio_secs ?? 0, mime: a.audio_mime ?? "audio/webm" } : undefined, enabled: a.enabled !== false,
    })),
    praises: (j.praises ?? []).map((p: any): Praise => ({ id: p.id, from: p.from_member, to: p.to_member, body: p.body, at: p.created_at, heard: p.heard === true, voice: p.voice === "m" ? "m" : "f", audio: p.audio_path ? { path: p.audio_path, secs: p.audio_secs ?? 0, mime: p.audio_mime ?? "audio/webm" } : undefined })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function supabaseBackend(familyId: string): Backend {
  const sb = getSupabase();
  return {
    // 1 lần gọi duy nhất lấy toàn bộ dữ liệu gia đình (xem hàm family_snapshot)
    async load() {
      return snapshotToData(val(await sb.rpc("family_snapshot", { p_days: 60 })), today());
    },

    subscribe(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fire = () => { clearTimeout(timer); timer = setTimeout(onChange, 250); };
      const ch = sb.channel(`family-${familyId}`);
      for (const table of ["submissions", "coin_ledger", "redemptions", "jar_goals", "challenges", "tasks", "rewards", "members", "task_overrides", "praises", "gardens", "plants", "garden_items", "alarms"]) {
        ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `family_id=eq.${familyId}` }, fire);
      }
      ch.subscribe();
      return () => { clearTimeout(timer); void sb.removeChannel(ch); };
    },

    async verifyPin(pin) {
      const { data: d, error } = await sb.rpc("verify_parent_pin", { p_pin: pin });
      if (error) throw new Error(error.message.includes("pin_locked") ? "pin_locked" : error.message);
      return d === true;
    },
    async kidSession(member) {
      const d = val(await sb.rpc("kid_session", { p_member: member })) as { remaining: number | null; in_window: boolean };
      return { remaining: d.remaining ?? null, inWindow: d.in_window };
    },
    async heartbeat(member, seconds) {
      return val(await sb.rpc("heartbeat", { p_member: member, p_seconds: seconds })) as number;
    },
    submitTask: async (member, task) => ok(await sb.rpc("submit_task", { p_member: member, p_task: task })),
    approve: async (sub, reviewer, sticker) => ok(await sb.rpc("approve_submission", { p_submission: sub, p_reviewer: reviewer, p_sticker: sticker })),
    revokeApproval: async (sub) => ok(await sb.rpc("revoke_approval", { p_submission: sub })),
    remind: async (sub) => ok(await sb.rpc("remind_submission", { p_submission: sub })),
    judge: async (parent, task, kid) => ok(await sb.rpc("judge_parent_task", { p_parent: parent, p_task: task, p_kid: kid })),
    markSeen: async (subs) => { if (subs.length) ok(await sb.from("submissions").update({ seen_by_member: true }).in("id", subs)); },
    redeem: async (member, reward) => ok(await sb.rpc("redeem_reward", { p_member: member, p_reward: reward })),
    completePromise: async (id) => ok(await sb.rpc("complete_redemption", { p_id: id })),
    cancelPromise: async (id) => ok(await sb.rpc("cancel_redemption", { p_id: id })),
    setPromiseNote: async (id, note) => ok(await sb.from("redemptions").update({ scheduled_note: note.trim() || null }).eq("id", id)),
    async contributeJar(member, goal, amount) {
      return val(await sb.rpc("contribute_jar", { p_member: member, p_goal: goal, p_amount: amount })) === true;
    },
    setJarGoal: async (title, target) => ok(await sb.rpc("set_jar_goal", { p_title: title, p_target: target })),

    addTask: async (v) => ok(await sb.from("tasks").insert({
      family_id: familyId, title: v.title, icon: v.icon, coins: v.coins, slot: v.slot, audience: v.who,
      kid_ids: v.who === "parent" ? null : v.kids ?? null, parent_ids: v.who === "kid" ? null : v.parents ?? null,
      repeat_days: v.repeat, due_time: v.due || null, est_minutes: v.est || null, self_check: v.selfCheck === true,
    })),
    updateTask: async (id, v) => ok(await sb.from("tasks").update({
      title: v.title, icon: v.icon, coins: v.coins, slot: v.slot, audience: v.who,
      kid_ids: v.who === "parent" ? null : v.kids ?? null, parent_ids: v.who === "kid" ? null : v.parents ?? null,
      repeat_days: v.repeat, due_time: v.due || null, est_minutes: v.est || null, self_check: v.selfCheck === true,
    }).eq("id", id)),
    setDayPlan: async (day, items) => ok(await sb.rpc("set_day_plan", { p_day: day, p_items: items })),
    addTaskForDay: async (v, day, keep) => ok(await sb.rpc("add_oneoff_task", {
      p_day: day, p_title: v.title, p_icon: v.icon, p_coins: v.coins, p_slot: v.slot, p_audience: v.who,
      p_kid_ids: v.who === "parent" ? null : v.kids ?? null, p_parent_ids: v.who === "kid" ? null : v.parents ?? null,
      p_due: v.due || null, p_est: v.est || null, p_self: v.selfCheck === true, p_keep: keep, p_repeat: v.repeat,
    })),
    toggleSelfTask: async (parent, task) => ok(await sb.rpc("toggle_self_task", { p_parent: parent, p_task: task })),
    removeTask: async (id) => ok(await sb.from("tasks").update({ active: false }).eq("id", id)),
    addReward: async (v) => ok(await sb.from("rewards").insert({ family_id: familyId, title: v.title, icon: v.icon, cost: v.cost, tier: v.tier })),
    updateReward: async (id, v) => ok(await sb.from("rewards").update({ title: v.title, icon: v.icon, cost: v.cost, tier: v.tier }).eq("id", id)),
    removeReward: async (id) => ok(await sb.from("rewards").update({ active: false }).eq("id", id)),
    addChallenge: async (v) => ok(await sb.from("challenges").insert({
      family_id: familyId, title: v.title, member_a: v.a, member_b: v.b, target: v.target, prize: v.prize,
      linked_task_id: v.linkedTask || null, ends_on: addDays(today(), 7),
    })),
    async updateChallenge(id, v) {
      const c = val(await sb.from("challenges").select("progress_a, progress_b").eq("id", id).single());
      ok(await sb.from("challenges").update({
        title: v.title, target: v.target, prize: v.prize, linked_task_id: v.linkedTask || null,
        progress_a: Math.min(v.target, c.progress_a), progress_b: Math.min(v.target, c.progress_b),
      }).eq("id", id));
    },
    bumpChallenge: async (id, who, delta) => ok(await sb.rpc("bump_challenge", { p_id: id, p_member: who, p_delta: delta })),
    removeChallenge: async (id) => ok(await sb.from("challenges").update({ status: "done" }).eq("id", id)),

    async saveSettings(v) {
      ok(await sb.from("families").update({
        name: v.familyName.trim() || "Nhà mình", golden_start: v.start, golden_end: v.end,
        daily_minutes: v.minutes, enforce_golden: v.enforce, leaderboard_opt_in: v.leaderboard, limit_enabled: v.limitEnabled,
      }).eq("id", familyId));
      if (v.newPin) ok(await sb.rpc("set_parent_pin", { p_old: v.oldPin ?? "", p_new: v.newPin }));
    },
    async addMember(m) {
      const { count } = await sb.from("members").select("id", { count: "exact", head: true }).eq("role", m.role);
      const d = makeMember("", m, count ?? 0);
      ok(await sb.from("members").insert({ family_id: familyId, name: d.name, role: d.role, color: d.color, initial: d.initial, sort_order: 100 + (count ?? 0) }));
    },
    async updateMember(id, v) {
      const m = val(await sb.from("members").select("role").eq("id", id).single());
      ok(await sb.from("members").update({ name: v.name.trim(), color: v.color, avatar: v.avatar || null, initial: initialOf(v.name, m.role as Role) }).eq("id", id));
    },
    removeMember: async (id) => ok(await sb.from("members").delete().eq("id", id)),

    async leaderboard() {
      const rows = val(await sb.rpc("family_leaderboard")) as { rank: number; family_name: string; week_coins: number; member_count: number; avg_coins: number; is_mine: boolean }[];
      return rows.map((r) => ({ rank: r.rank, name: r.family_name, weekCoins: Number(r.week_coins), members: r.member_count, avg: Number(r.avg_coins), mine: r.is_mine }));
    },
    pushSubscribe: async (sub, label) => ok(await sb.from("push_subscriptions").upsert(
      { family_id: familyId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label },
      { onConflict: "endpoint" },
    )),
    pushUnsubscribe: async (endpoint) => ok(await sb.from("push_subscriptions").delete().eq("endpoint", endpoint)),
    async notify(kind) {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return 0;
        const res = await fetch("/api/notify", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ kind }),
        });
        if (!res.ok) return 0;
        return ((await res.json()) as { sent?: number }).sent ?? 0;
      } catch {
        return 0; // thông báo là phần phụ, lỗi cũng không ảnh hưởng thao tác chính
      }
    },
    async reviewRange(from, to) {
      // Mỗi lần gọi trả tối đa 1000 dòng, nên chia khoảng dài thành từng đoạn 90 ngày
      const parts: [string, string][] = [];
      for (let a = from; a <= to; a = addDays(a, 90)) parts.push([a, addDays(a, 89) < to ? addDays(a, 89) : to]);
      const chunks = await Promise.all(parts.map(async ([a, b]) =>
        val(await sb.rpc("review_range", { p_from: a, p_to: b })) as { member_id: string; day: string; planned: number; done: number; coins: number; stickers: string[]; done_titles: string[]; missed: string[] }[]));
      return chunks.flat().map((r) => ({
        member: r.member_id, day: r.day, planned: r.planned, done: r.done, coins: Number(r.coins),
        stickers: r.stickers ?? [], doneTitles: r.done_titles ?? [], missed: r.missed ?? [],
      }));
    },
    async sendPraise(from, to, body, voice, audio) {
      let path: string | null = null;
      if (audio) {
        // Tải file ghi âm lên kho riêng của nhà, rồi mới ghi lời khen; ghi lời khen lỗi thì xoá file vừa tải
        path = `${familyId}/${crypto.randomUUID()}.${extOf(audio.mime)}`;
        const up = await sb.storage.from("praise-audio").upload(path, audio.blob, { contentType: baseMime(audio.mime), cacheControl: "0" });
        if (up.error) throw new Error(up.error.message.includes("size") ? "audio_too_big" : "audio_upload_failed");
      }
      const r = await sb.rpc("send_praise", {
        p_from: from, p_to: to, p_body: body, p_voice: voice,
        p_audio_path: path, p_audio_secs: audio?.secs ?? null, p_audio_mime: audio ? baseMime(audio.mime) : null,
      });
      if (r.error) {
        if (path) await sb.storage.from("praise-audio").remove([path]);
        throw new Error(r.error.message);
      }
    },
    async praiseAudio(path) {
      const { data, error } = await sb.storage.from("praise-audio").download(path);
      return error ? null : data;
    },
    async tts(req) {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        const res = await fetch("/api/tts", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(req),
        });
        return res.ok ? await res.blob() : null;
      } catch {
        return null;
      }
    },
    markPraiseHeard: async (id) => ok(await sb.rpc("mark_praise_heard", { p_id: id })),
    sellPot: async (member, item) => Number(val(await sb.rpc("sell_pot", { p_member: member, p_item: item }))),
    async saveAlarm(a, take, oldAudioPath) {
      let audio = a.audio ?? null;
      if (take) {
        const path = `${familyId}/${crypto.randomUUID()}.${extOf(take.mime)}`;
        const up = await sb.storage.from("praise-audio").upload(path, take.blob, { contentType: baseMime(take.mime), cacheControl: "0" });
        if (up.error) throw new Error(up.error.message.includes("size") ? "audio_too_big" : "audio_upload_failed");
        audio = { path, secs: take.secs, mime: baseMime(take.mime) };
      }
      const r = await sb.rpc("save_alarm", {
        p_id: a.id ?? null, p_title: a.title, p_at: a.at, p_repeat: a.repeat, p_kid_ids: a.kids ?? null, p_tone: a.tone, p_body: a.body, p_voice: a.voice,
        p_audio_path: audio?.path ?? null, p_audio_secs: audio?.secs ?? null, p_audio_mime: audio?.mime ?? null, p_enabled: a.enabled,
      });
      if (r.error) {
        if (take && audio) await sb.storage.from("praise-audio").remove([audio.path]);
        throw new Error(r.error.message);
      }
      if (oldAudioPath && oldAudioPath !== audio?.path) await sb.storage.from("praise-audio").remove([oldAudioPath]);
    },
    setAlarmEnabled: async (id, enabled) => ok(await sb.rpc("set_alarm_enabled", { p_id: id, p_enabled: enabled })),
    ackAlarm: async (id) => ok(await sb.rpc("ack_alarm", { p_id: id })),
    async deleteAlarm(id) {
      const row = await sb.from("alarms").select("audio_path").eq("id", id).maybeSingle();
      ok(await sb.rpc("delete_alarm", { p_id: id }));
      const path = row.data?.audio_path as string | null | undefined;
      if (path) await sb.storage.from("praise-audio").remove([path]);
    },
    startGarden: async (member) => ok(await sb.rpc("start_garden", { p_member: member })),
    buySeed: async (member, species, slot) => ok(await sb.rpc("buy_seed", { p_member: member, p_species: species, p_slot: slot })),
    buySlot: async (member) => ok(await sb.rpc("buy_slot", { p_member: member })),
    buyPot: async (member, item) => ok(await sb.rpc("buy_pot", { p_member: member, p_item: item })),
    setPot: async (plant, item) => ok(await sb.rpc("set_pot", { p_plant: plant, p_item: item })),
    waterPlant: async (plant, amount) => Number(val(await sb.rpc("water_plant", { p_plant: plant, p_amount: amount }))),
    harvestPlant: async (plant) => Number(val(await sb.rpc("harvest_plant", { p_plant: plant }))),
    saveGardenSettings: async (enabled, cap) => ok(await sb.from("families").update({ garden_enabled: enabled, garden_weekly_cap: cap }).eq("id", familyId)),
    async deletePraise(id) {
      const row = await sb.from("praises").select("audio_path").eq("id", id).maybeSingle();
      ok(await sb.rpc("delete_praise", { p_id: id }));
      const path = row.data?.audio_path as string | null | undefined;
      if (path) await sb.storage.from("praise-audio").remove([path]);
    },
    async weekReport(offset) {
      const rows = val(await sb.rpc("week_report", { p_offset: offset })) as { member_id: string; day: string; earned: number; spent: number; tasks_done: number }[];
      const start = weekStartOf(offset);
      return {
        start, days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
        rows: rows.map((r) => ({ member: r.member_id, day: r.day, earned: Number(r.earned), spent: Number(r.spent), tasks: r.tasks_done })),
      };
    },
  };
}
