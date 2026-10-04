import type { IconName } from "@/components/Icon";
import { ICON_PATHS } from "@/components/Icon";
import { BGS, addDays, hhmmOf, today } from "./data";
import { getSupabase } from "./supabase";
import type { Challenge, Data, Member, Reward, Role, Settings, Slot, Submission, Task, Tier, Who } from "./types";

/**
 * Lớp nói chuyện với server. Giao diện chỉ biết interface này:
 * chế độ dùng thử (demo.ts) và chế độ Supabase dùng chung một giao diện.
 * Mọi thao tác ghi Ủn đều đi qua hàm trên server (xem supabase/migrations).
 */
export type NewMember = { name: string; role: Role };
export type KidSession = { remaining: number; inWindow: boolean };
export type LeaderRow = { rank: number; name: string; weekCoins: number; members: number; avg: number; mine: boolean };
export type SettingsInput = {
  familyName: string; start: string; end: string; minutes: number; enforce: boolean; leaderboard: boolean;
  oldPin?: string; newPin?: string;
};
export type NewTask = { title: string; coins: number; slot: Slot; who: Who; icon: IconName };
export type NewReward = { title: string; cost: number; tier: Tier; icon: IconName };
export type NewChallenge = { a: string; b: string; title: string; target: number; prize: string; linkedTask?: string };

export interface Backend {
  load(): Promise<Data>;
  subscribe(onChange: () => void): () => void;
  verifyPin(pin: string): Promise<boolean>;
  kidSession(member: string): Promise<KidSession>;
  heartbeat(member: string, seconds: number): Promise<number>;
  submitTask(member: string, task: string): Promise<void>;
  approve(sub: string, reviewer: string, sticker: string): Promise<void>;
  remind(sub: string): Promise<void>;
  judge(parent: string, task: string, kid: string): Promise<void>;
  markSeen(subs: string[]): Promise<void>;
  redeem(member: string, reward: string): Promise<void>;
  completePromise(id: string): Promise<void>;
  contributeJar(member: string, goal: string, amount: number): Promise<boolean>;
  setJarGoal(title: string, target: number): Promise<void>;
  addTask(v: NewTask): Promise<void>;
  removeTask(id: string): Promise<void>;
  addReward(v: NewReward): Promise<void>;
  removeReward(id: string): Promise<void>;
  addChallenge(v: NewChallenge): Promise<void>;
  bumpChallenge(id: string, who: string): Promise<void>;
  removeChallenge(id: string): Promise<void>;
  saveSettings(v: SettingsInput): Promise<void>;
  addMember(m: NewMember): Promise<void>;
  removeMember(id: string): Promise<void>;
  leaderboard(): Promise<LeaderRow[]>;
}

/* ---------- Màu avatar ---------- */
const PARENT_COLORS = ["#FFB27A", "#FF9CC2", "#FFD36B", "#9ED9FF"];
const KID_COLORS = ["#3DD6B5", "#B9A6FF", "#FF8FB8", "#7FD1FF", "#FFC93C", "#FF8A3D"];

export function makeMember(id: string, m: NewMember, index: number): Member {
  const name = m.name.trim();
  const palette = m.role === "parent" ? PARENT_COLORS : KID_COLORS;
  const color = palette[index % palette.length];
  return {
    id, name, role: m.role, color,
    soft: `${color}33`,
    initial: m.role === "parent" ? (name.length <= 2 ? name : name[0].toUpperCase()) : name[0].toUpperCase(),
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

/* ---------- Thông tin gia đình ---------- */
const hhmm = (t: string) => t.slice(0, 5);
type MemberRow = { id: string; name: string; role: Role; color: string; initial: string };
const rowToMember = (r: MemberRow): Member => ({
  id: r.id, name: r.name, role: r.role, color: r.color, soft: `${r.color}33`, initial: r.initial,
  label: r.role === "kid" ? "Con" : undefined,
});

export async function getFamilyId(): Promise<string | null> {
  const { data, error } = await getSupabase().from("families").select("id").maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export type FamilySetup = { name: string; pin: string; members: NewMember[]; start: string; end: string; minutes: number; enforce: boolean; leaderboard: boolean };

export async function createFamily(v: FamilySetup) {
  const counts: Record<Role, number> = { parent: 0, kid: 0 };
  const payload = v.members.map((m) => {
    const mm = makeMember("", m, counts[m.role]++);
    return { name: mm.name, role: mm.role, color: mm.color, initial: mm.initial };
  });
  const { error } = await getSupabase().rpc("create_family", {
    p_name: v.name, p_pin: v.pin, p_members: payload,
    p_settings: { golden_start: v.start, golden_end: v.end, daily_minutes: v.minutes, enforce_golden: v.enforce, leaderboard_opt_in: v.leaderboard },
  });
  if (error) throw error;
}

/* ---------- Backend Supabase ---------- */
const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};
const ok = (r: { error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
};

export function supabaseBackend(familyId: string): Backend {
  const sb = getSupabase();
  return {
    async load() {
      const t0 = today();
      const [fam, ms, ts, rs, subs, reds, goals, chs, stats] = await Promise.all([
        sb.from("families").select("name, golden_start, golden_end, daily_minutes, enforce_golden, leaderboard_opt_in").single(),
        sb.from("members").select("id, name, role, color, initial").order("sort_order").order("created_at"),
        sb.from("tasks").select("id, title, icon, coins, slot, audience, partner").eq("active", true).order("created_at"),
        sb.from("rewards").select("id, title, icon, cost, tier").eq("active", true).order("cost"),
        sb.from("submissions").select("id, member_id, task_id, day, status, reviewer_id, sticker, seen_by_member, submitted_at").gte("day", addDays(t0, -60)),
        sb.from("redemptions").select("id, member_id, reward_id, status, scheduled_note").neq("status", "cancelled").order("created_at", { ascending: false }),
        sb.from("jar_goals").select("id, title, target, status, created_at").neq("status", "archived").order("created_at", { ascending: false }),
        sb.from("challenges").select("id, title, member_a, member_b, target, progress_a, progress_b, linked_task_id, prize, ends_on").eq("status", "active"),
        sb.rpc("member_stats"),
      ]);
      const f = must(fam);
      const members = must(ms).map(rowToMember);
      const goalRows = must(goals);
      const goal = goalRows.find((g) => g.status === "active") ?? goalRows[0];
      const contrib: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
      if (goal) {
        const led = must(await sb.from("coin_ledger").select("member_id, amount").eq("kind", "jar").eq("ref_id", goal.id));
        for (const l of led) contrib[l.member_id] = (contrib[l.member_id] ?? 0) - l.amount;
      }
      const submissions: Submission[] = must(subs).map((s) => ({
        id: s.id, member: s.member_id, task: s.task_id, date: s.day, status: s.status, time: hhmmOf(new Date(s.submitted_at)),
        by: s.reviewer_id ?? undefined, sticker: s.sticker ?? undefined, seen: s.seen_by_member ?? false,
      }));
      const coins: Record<string, number> = {}, week: Record<string, number> = {}, lastWeek: Record<string, number> = {}, streak: Record<string, number> = {};
      for (const m of members) { coins[m.id] = 0; week[m.id] = 0; lastWeek[m.id] = 0; }
      for (const r of must(stats)) { coins[r.member_id] = Number(r.balance); week[r.member_id] = Number(r.week_coins); lastWeek[r.member_id] = Number(r.last_week_coins); }
      for (const m of members) if (m.role === "kid") streak[m.id] = streakOf(submissions, m.id, t0);
      const tasks: Task[] = must(ts).map((t) => ({
        id: t.id, title: t.title, icon: safeIcon(t.icon), coins: t.coins, slot: t.slot, who: t.audience,
        partner: t.partner ?? undefined, bg: hashBg(t.id),
      }));
      const rewards: Reward[] = must(rs).map((r) => ({ id: r.id, title: r.title, icon: safeIcon(r.icon), cost: r.cost, tier: r.tier, bg: hashBg(r.id) }));
      const challenges: Challenge[] = must(chs).map((c) => ({
        id: c.id, a: c.member_a, b: c.member_b, title: c.title, target: c.target,
        prog: { [c.member_a]: c.progress_a, [c.member_b]: c.progress_b }, prize: c.prize ?? "",
        daysLeft: Math.max(0, Math.round((Date.parse(c.ends_on) - Date.parse(t0)) / 86400000)), linkedTask: c.linked_task_id ?? undefined,
      }));
      const settings: Settings = { start: hhmm(f.golden_start), end: hhmm(f.golden_end), minutes: f.daily_minutes, enforce: f.enforce_golden, leaderboard: f.leaderboard_opt_in };
      return {
        familyName: f.name === "Nhà mình" ? "" : f.name,
        members, coins, week, lastWeek, streak, tasks, subs: submissions, rewards,
        promises: must(reds).map((p) => ({ id: p.id, member: p.member_id, reward: p.reward_id, status: p.status === "done" ? "done" as const : "promised" as const, at: p.scheduled_note ?? "Bố mẹ sẽ hẹn ngày" })),
        jar: { id: goal?.id ?? "", goal: goal?.title ?? "Hũ Mơ Ước", target: goal?.target ?? 500, contrib, reached: goal?.status === "reached" },
        challenges, settings,
      } satisfies Data;
    },

    subscribe(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fire = () => { clearTimeout(timer); timer = setTimeout(onChange, 250); };
      const ch = sb.channel(`family-${familyId}`);
      for (const table of ["submissions", "coin_ledger", "redemptions", "jar_goals", "challenges", "tasks", "rewards", "members"]) {
        ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `family_id=eq.${familyId}` }, fire);
      }
      ch.subscribe();
      return () => { clearTimeout(timer); void sb.removeChannel(ch); };
    },

    async verifyPin(pin) {
      const { data, error } = await sb.rpc("verify_parent_pin", { p_pin: pin });
      if (error) throw new Error(error.message.includes("pin_locked") ? "pin_locked" : error.message);
      return data === true;
    },
    async kidSession(member) {
      const d = must(await sb.rpc("kid_session", { p_member: member })) as { remaining: number; in_window: boolean };
      return { remaining: d.remaining, inWindow: d.in_window };
    },
    async heartbeat(member, seconds) {
      return must(await sb.rpc("heartbeat", { p_member: member, p_seconds: seconds })) as number;
    },
    submitTask: async (member, task) => ok(await sb.rpc("submit_task", { p_member: member, p_task: task })),
    approve: async (sub, reviewer, sticker) => ok(await sb.rpc("approve_submission", { p_submission: sub, p_reviewer: reviewer, p_sticker: sticker })),
    remind: async (sub) => ok(await sb.rpc("remind_submission", { p_submission: sub })),
    judge: async (parent, task, kid) => ok(await sb.rpc("judge_parent_task", { p_parent: parent, p_task: task, p_kid: kid })),
    markSeen: async (subs) => { if (subs.length) ok(await sb.from("submissions").update({ seen_by_member: true }).in("id", subs)); },
    redeem: async (member, reward) => ok(await sb.rpc("redeem_reward", { p_member: member, p_reward: reward })),
    completePromise: async (id) => ok(await sb.rpc("complete_redemption", { p_id: id })),
    async contributeJar(member, goal, amount) {
      return must(await sb.rpc("contribute_jar", { p_member: member, p_goal: goal, p_amount: amount })) === true;
    },
    setJarGoal: async (title, target) => ok(await sb.rpc("set_jar_goal", { p_title: title, p_target: target })),

    addTask: async (v) => ok(await sb.from("tasks").insert({ family_id: familyId, title: v.title, icon: v.icon, coins: v.coins, slot: v.slot, audience: v.who, partner: v.who === "together" ? "all" : null })),
    removeTask: async (id) => ok(await sb.from("tasks").update({ active: false }).eq("id", id)),
    addReward: async (v) => ok(await sb.from("rewards").insert({ family_id: familyId, title: v.title, icon: v.icon, cost: v.cost, tier: v.tier })),
    removeReward: async (id) => ok(await sb.from("rewards").update({ active: false }).eq("id", id)),
    addChallenge: async (v) => ok(await sb.from("challenges").insert({
      family_id: familyId, title: v.title, member_a: v.a, member_b: v.b, target: v.target, prize: v.prize,
      linked_task_id: v.linkedTask || null, ends_on: addDays(today(), 7),
    })),
    async bumpChallenge(id, who) {
      const c = must(await sb.from("challenges").select("member_a, member_b, target, progress_a, progress_b").eq("id", id).single());
      if (c.member_a === who) ok(await sb.from("challenges").update({ progress_a: Math.min(c.target, c.progress_a + 1) }).eq("id", id));
      else if (c.member_b === who) ok(await sb.from("challenges").update({ progress_b: Math.min(c.target, c.progress_b + 1) }).eq("id", id));
    },
    removeChallenge: async (id) => ok(await sb.from("challenges").update({ status: "done" }).eq("id", id)),

    async saveSettings(v) {
      ok(await sb.from("families").update({
        name: v.familyName.trim() || "Nhà mình", golden_start: v.start, golden_end: v.end,
        daily_minutes: v.minutes, enforce_golden: v.enforce, leaderboard_opt_in: v.leaderboard,
      }).eq("id", familyId));
      if (v.newPin) ok(await sb.rpc("set_parent_pin", { p_old: v.oldPin ?? "", p_new: v.newPin }));
    },
    async addMember(m) {
      const { count } = await sb.from("members").select("id", { count: "exact", head: true }).eq("role", m.role);
      const d = makeMember("", m, count ?? 0);
      ok(await sb.from("members").insert({ family_id: familyId, name: d.name, role: d.role, color: d.color, initial: d.initial, sort_order: 100 + (count ?? 0) }));
    },
    removeMember: async (id) => ok(await sb.from("members").delete().eq("id", id)),

    async leaderboard() {
      const rows = must(await sb.rpc("family_leaderboard")) as { rank: number; family_name: string; week_coins: number; member_count: number; avg_coins: number; is_mine: boolean }[];
      return rows.map((r) => ({ rank: r.rank, name: r.family_name, weekCoins: Number(r.week_coins), members: r.member_count, avg: Number(r.avg_coins), mine: r.is_mine }));
    },
  };
}
