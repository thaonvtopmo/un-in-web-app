import type { Backend, LeaderRow } from "./backend";
import { makeMember } from "./backend";
import { BGS, DEMO_PIN, hhmm, jarTotal, partnersOf, seedData, today, toMin } from "./data";
import type { Data } from "./types";

/** Bản dùng thử: chạy hoàn toàn trong bộ nhớ trình duyệt, cùng giao diện với bản Supabase. */
let _id = 100;
const uid = () => "id" + ++_id;

export function demoBackend(): Backend {
  const S: Data = seedData();
  let pin = DEMO_PIN;
  let usedSeconds = 0;
  const task = (id: string) => S.tasks.find((t) => t.id === id);
  const bal = (id: string) => S.coins[id] ?? 0;
  const add = (id: string, n: number) => { S.coins[id] = (S.coins[id] || 0) + n; S.week[id] = (S.week[id] || 0) + n; };
  const fail = (code: string): never => { throw new Error(code); };
  const inWindow = () => {
    const parts = hhmm().split(":").map(Number);
    const n = parts[0] * 60 + parts[1];
    return n >= toMin(S.settings.start) && n <= toMin(S.settings.end);
  };
  const guardKid = () => {
    if (S.settings.enforce && !inWindow()) fail("outside_window");
    if (usedSeconds >= S.settings.minutes * 60) fail("time_up");
  };

  return {
    load: async () => structuredClone(S),
    subscribe: () => () => {},
    verifyPin: async (p) => p === pin,
    kidSession: async () => ({ remaining: Math.max(0, S.settings.minutes * 60 - usedSeconds), inWindow: !S.settings.enforce || inWindow() }),
    heartbeat: async (_m, seconds) => {
      usedSeconds += Math.min(Math.max(seconds, 0), 60);
      return Math.max(0, S.settings.minutes * 60 - usedSeconds);
    },
    submitTask: async (member, tid) => {
      guardKid();
      const ex = S.subs.filter((s) => s.member === member && s.task === tid && s.date === today()).pop();
      if (!ex) S.subs.push({ id: uid(), member, task: tid, date: today(), status: "pending", time: hhmm() });
      else if (ex.status === "redo") { ex.status = "pending"; ex.time = hhmm(); }
    },
    approve: async (sid, reviewer, sticker) => {
      const s = S.subs.find((x) => x.id === sid);
      if (!s || s.status === "approved") return;
      if (s.member === reviewer) fail("self_review");
      const t = task(s.task);
      if (!t) return;
      s.status = "approved"; s.by = reviewer; s.sticker = sticker || "Giỏi quá!"; s.seen = false;
      add(s.member, t.coins);
      partnersOf(S, t).forEach((pid) => add(pid, t.coins));
      S.challenges.forEach((c) => {
        if (c.linkedTask === t.id && (c.a === s.member || c.b === s.member) && c.prog[s.member] < c.target) c.prog[s.member]++;
      });
    },
    remind: async (sid) => { const s = S.subs.find((x) => x.id === sid); if (s && s.status === "pending") s.status = "redo"; },
    judge: async (parent, tid, kid) => {
      guardKid();
      const t = task(tid);
      if (!t) return;
      const ex = S.subs.filter((s) => s.member === parent && s.task === tid && s.date === today()).pop();
      if (ex && ex.status === "approved") { S.subs = S.subs.filter((s) => s.id !== ex.id); add(parent, -t.coins); }
      else { S.subs.push({ id: uid(), member: parent, task: tid, date: today(), status: "approved", time: hhmm(), by: kid, seen: true }); add(parent, t.coins); }
    },
    markSeen: async (ids) => { S.subs.forEach((s) => { if (ids.includes(s.id)) s.seen = true; }); },
    redeem: async (member, rid) => {
      guardKid();
      const r = S.rewards.find((x) => x.id === rid);
      if (!r) return fail("invalid_reward");
      if (bal(member) < r.cost) fail("insufficient");
      S.coins[member] -= r.cost;
      S.promises.unshift({ id: uid(), member, reward: rid, status: "promised", at: "Bố mẹ sẽ hẹn ngày" });
    },
    completePromise: async (id) => { const p = S.promises.find((x) => x.id === id); if (p) p.status = "done"; },
    contributeJar: async (member, _goal, amount) => {
      if (S.members.find((m) => m.id === member)?.role === "kid") guardKid();
      if (S.jar.reached) fail("jar_closed");
      if (bal(member) < amount) fail("insufficient");
      S.coins[member] -= amount;
      S.jar.contrib[member] = (S.jar.contrib[member] || 0) + amount;
      if (jarTotal(S) >= S.jar.target) { S.jar.reached = true; return true; }
      return false;
    },
    setJarGoal: async (title, target) => {
      if (S.jar.reached) { S.jar = { id: uid(), goal: title, target, contrib: Object.fromEntries(S.members.map((m) => [m.id, 0])), reached: false }; return; }
      S.jar.goal = title; S.jar.target = target;
      if (jarTotal(S) >= target) S.jar.reached = true;
    },
    addTask: async (v) => { S.tasks.push({ id: uid(), title: v.title, coins: v.coins, slot: v.slot, who: v.who, partner: "all", icon: v.icon, bg: BGS[S.tasks.length % BGS.length] }); },
    removeTask: async (id) => { S.tasks = S.tasks.filter((t) => t.id !== id); },
    addReward: async (v) => { S.rewards.push({ id: uid(), title: v.title, cost: v.cost, tier: v.tier, icon: v.icon, bg: BGS[S.rewards.length % BGS.length] }); },
    removeReward: async (id) => { S.rewards = S.rewards.filter((r) => r.id !== id); },
    addChallenge: async (v) => { S.challenges.push({ id: uid(), a: v.a, b: v.b, title: v.title, target: v.target, prog: { [v.a]: 0, [v.b]: 0 }, prize: v.prize, daysLeft: 7, linkedTask: v.linkedTask }); },
    bumpChallenge: async (id, who) => { const c = S.challenges.find((x) => x.id === id); if (c && c.prog[who] < c.target) c.prog[who]++; },
    removeChallenge: async (id) => { S.challenges = S.challenges.filter((c) => c.id !== id); },
    saveSettings: async (v) => {
      if (v.newPin) { if (v.oldPin !== pin) fail("wrong_pin"); pin = v.newPin; }
      S.familyName = v.familyName.trim();
      Object.assign(S.settings, { start: v.start, end: v.end, minutes: v.minutes, enforce: v.enforce, leaderboard: v.leaderboard });
    },
    addMember: async (m) => {
      const mm = makeMember(uid(), m, S.members.filter((x) => x.role === m.role).length);
      S.members.push(mm);
      S.coins[mm.id] = 0; S.week[mm.id] = 0; S.lastWeek[mm.id] = 0; S.streak[mm.id] = 0; S.jar.contrib[mm.id] = 0;
    },
    removeMember: async (id) => {
      S.members = S.members.filter((m) => m.id !== id);
      for (const k of [S.coins, S.week, S.lastWeek, S.streak, S.jar.contrib]) delete k[id];
      S.subs = S.subs.filter((x) => x.member !== id);
      S.promises = S.promises.filter((x) => x.member !== id);
      S.challenges = S.challenges.filter((c) => c.a !== id && c.b !== id);
    },
    leaderboard: async (): Promise<LeaderRow[]> => {
      const mine = S.members.reduce((a, m) => a + (S.week[m.id] || 0), 0);
      const rows = [
        { name: "Nhà Gấu Bông", weekCoins: 640, members: 4 }, { name: "Nhà Cún Con", weekCoins: 520, members: 3 },
        { name: S.familyName || "Nhà dùng thử", weekCoins: mine, members: S.members.length }, { name: "Nhà Bánh Bao", weekCoins: 250, members: 4 },
      ].map((r) => ({ ...r, avg: Math.round((r.weekCoins / r.members) * 10) / 10, mine: r.name === (S.familyName || "Nhà dùng thử") }));
      return rows.sort((a, b) => b.avg - a.avg).map((r, i) => ({ ...r, rank: i + 1 }));
    },
  };
}
