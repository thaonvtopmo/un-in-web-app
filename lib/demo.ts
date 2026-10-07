import type { Backend, LeaderRow, WeekReport } from "./backend";
import { initialOf, makeMember, weekStartOf } from "./backend";
import { BGS, DEMO_PIN, addDays, hhmm, jarTotal, seedData, today, toMin } from "./data";
import { ruleSelfToggle, rulePlan, ruleApprove, ruleCancelPromise, ruleGive, ruleJudge, ruleRedeem, ruleRemind, ruleRevoke, ruleSubmit } from "./rules";
import { ruleSellPot, ruleBuyPot, ruleBuySeed, ruleBuySlot, ruleHarvest, ruleSetPot, ruleStartGarden, ruleWater, refreshEarned } from "./garden";
import { demoHistory, summarizeDay } from "./review";
import type { Data } from "./types";

/** Bản dùng thử: chạy hoàn toàn trong bộ nhớ trình duyệt, cùng giao diện với bản Supabase. */
let _id = 100;
const uid = () => "id" + ++_id;

export function demoBackend(): Backend {
  const recordings = new Map<string, Blob>(); // bản dùng thử giữ file ghi âm trong bộ nhớ
  const S: Data = seedData();
  let pin = DEMO_PIN;
  let usedSeconds = 0;
  const bal = (id: string) => S.coins[id] ?? 0;
  const fail = (code: string): never => { throw new Error(code); };
  const inWindow = () => {
    const parts = hhmm().split(":").map(Number);
    const n = parts[0] * 60 + parts[1];
    return n >= toMin(S.settings.start) && n <= toMin(S.settings.end);
  };
  const guardKid = () => {
    if (S.settings.enforce && !inWindow()) fail("outside_window");
    if (S.settings.limitEnabled && usedSeconds >= S.settings.minutes * 60) fail("time_up");
  };

  return {
    load: async () => { refreshEarned(S); return structuredClone(S); },
    subscribe: () => () => {},
    verifyPin: async (p) => p === pin,
    kidSession: async () => ({ remaining: S.settings.limitEnabled ? Math.max(0, S.settings.minutes * 60 - usedSeconds) : null, inWindow: !S.settings.enforce || inWindow() }),
    heartbeat: async (_m, seconds) => {
      if (!S.settings.limitEnabled) return -1;
      usedSeconds += Math.min(Math.max(seconds, 0), 60);
      return Math.max(0, S.settings.minutes * 60 - usedSeconds);
    },
    submitTask: async (member, tid) => {
      guardKid();
      const t = S.tasks.find((x) => x.id === tid);
      if (t?.kids && !t.kids.includes(member)) fail("not_assigned");
      ruleSubmit(S, member, tid);
    },
    approve: async (sid, reviewer, sticker) => {
      const s = S.subs.find((x) => x.id === sid);
      if (s && s.member === reviewer) fail("self_review");
      ruleApprove(S, sid, reviewer, sticker);
    },
    revokeApproval: async (sid) => {
      const s = S.subs.find((x) => x.id === sid);
      if (!s || s.status !== "approved") fail("not_approved");
      ruleRevoke(S, sid);
    },
    remind: async (sid) => ruleRemind(S, sid),
    judge: async (parent, tid, kid) => {
      guardKid();
      const t = S.tasks.find((x) => x.id === tid);
      if (t?.parents && !t.parents.includes(parent)) fail("not_assigned");
      ruleJudge(S, parent, tid, kid);
    },
    markSeen: async (ids) => { S.subs.forEach((s) => { if (ids.includes(s.id)) s.seen = true; }); },
    redeem: async (member, rid) => {
      guardKid();
      const r = S.rewards.find((x) => x.id === rid);
      if (!r) return fail("invalid_reward");
      if (bal(member) < r.cost) fail("insufficient");
      ruleRedeem(S, member, rid);
    },
    completePromise: async (id) => { const p = S.promises.find((x) => x.id === id); if (p) p.status = "done"; },
    cancelPromise: async (id) => {
      const p = S.promises.find((x) => x.id === id);
      if (!p || p.status !== "promised") fail("not_promised");
      ruleCancelPromise(S, id);
    },
    setPromiseNote: async (id, note) => { const p = S.promises.find((x) => x.id === id); if (p) p.at = note.trim() || "Bố mẹ sẽ hẹn ngày"; },
    contributeJar: async (member, _goal, amount) => {
      if (S.members.find((m) => m.id === member)?.role === "kid") guardKid();
      if (S.jar.reached) fail("jar_closed");
      if (bal(member) < amount) fail("insufficient");
      return ruleGive(S, member, amount);
    },
    setJarGoal: async (title, target) => {
      if (S.jar.reached) { S.jar = { id: uid(), goal: title, target, contrib: Object.fromEntries(S.members.map((m) => [m.id, 0])), reached: false }; return; }
      S.jar.goal = title; S.jar.target = target;
      if (jarTotal(S) >= target) S.jar.reached = true;
    },
    addTask: async (v) => {
      S.tasks.push({
        id: uid(), title: v.title, coins: v.coins, slot: v.slot, who: v.who, icon: v.icon,
        kids: v.who === "parent" ? undefined : v.kids, parents: v.who === "kid" ? undefined : v.parents,
        repeat: v.repeat, due: v.due || undefined, est: v.est || undefined, selfCheck: v.selfCheck === true, bg: BGS[S.tasks.length % BGS.length],
      });
    },
    updateTask: async (id, v) => {
      const t = S.tasks.find((x) => x.id === id);
      if (t) Object.assign(t, { title: v.title, coins: v.coins, slot: v.slot, icon: v.icon, who: v.who, kids: v.who === "parent" ? undefined : v.kids, parents: v.who === "kid" ? undefined : v.parents, repeat: v.repeat, due: v.due || undefined, est: v.est || undefined, selfCheck: v.selfCheck === true });
    },
    removeTask: async (id) => { S.tasks = S.tasks.filter((t) => t.id !== id); },
    addReward: async (v) => { S.rewards.push({ id: uid(), ...v, bg: BGS[S.rewards.length % BGS.length] }); },
    updateReward: async (id, v) => { const r = S.rewards.find((x) => x.id === id); if (r) Object.assign(r, v); },
    removeReward: async (id) => { S.rewards = S.rewards.filter((r) => r.id !== id); },
    addChallenge: async (v) => { S.challenges.push({ id: uid(), a: v.a, b: v.b, title: v.title, target: v.target, prog: { [v.a]: 0, [v.b]: 0 }, prize: v.prize, daysLeft: 7, linkedTask: v.linkedTask }); },
    updateChallenge: async (id, v) => {
      const c = S.challenges.find((x) => x.id === id);
      if (!c) return;
      Object.assign(c, { title: v.title, target: v.target, prize: v.prize, linkedTask: v.linkedTask });
      for (const k of Object.keys(c.prog)) c.prog[k] = Math.min(v.target, c.prog[k]);
    },
    bumpChallenge: async (id, who, delta) => {
      const c = S.challenges.find((x) => x.id === id);
      if (c && who in c.prog) c.prog[who] = Math.min(c.target, Math.max(0, c.prog[who] + delta));
    },
    removeChallenge: async (id) => { S.challenges = S.challenges.filter((c) => c.id !== id); },
    saveSettings: async (v) => {
      if (v.newPin) { if (v.oldPin !== pin) fail("wrong_pin"); pin = v.newPin; }
      S.familyName = v.familyName.trim();
      Object.assign(S.settings, { start: v.start, end: v.end, minutes: v.minutes, enforce: v.enforce, leaderboard: v.leaderboard, limitEnabled: v.limitEnabled });
    },
    addMember: async (m) => {
      const mm = makeMember(uid(), m, S.members.filter((x) => x.role === m.role).length);
      S.members.push(mm);
      S.coins[mm.id] = 0; S.week[mm.id] = 0; S.lastWeek[mm.id] = 0; S.streak[mm.id] = 0; S.jar.contrib[mm.id] = 0;
    },
    setDayPlan: async (day, items) => rulePlan(S, day, items),
    addTaskForDay: async (v, day, keep) => {
      const id = uid();
      S.tasks.push({
        id, title: v.title, coins: v.selfCheck ? 0 : v.coins, slot: v.slot, who: v.who, icon: v.icon,
        kids: v.who === "parent" ? undefined : v.kids, parents: v.who === "kid" ? undefined : v.parents,
        repeat: keep ? v.repeat : 0, oneOff: !keep, due: v.due || undefined, est: v.est || undefined, selfCheck: v.selfCheck === true,
        bg: BGS[S.tasks.length % BGS.length],
      });
      rulePlan(S, day, [{ task: id, enabled: true }]);
    },
    toggleSelfTask: async (parent, task) => {
      const t = S.tasks.find((x) => x.id === task);
      if (!t?.selfCheck) fail("invalid_task");
      ruleSelfToggle(S, parent, task);
    },
    updateMember: async (id, v) => {
      const m = S.members.find((x) => x.id === id);
      if (m) Object.assign(m, { name: v.name.trim(), color: v.color, avatar: v.avatar || undefined, soft: `${v.color}33`, initial: initialOf(v.name, m.role) });
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
      const me = S.familyName || "Nhà dùng thử";
      const rows = [
        { name: "Nhà Gấu Bông", weekCoins: 640, members: 4 }, { name: "Nhà Cún Con", weekCoins: 520, members: 3 },
        { name: me, weekCoins: mine, members: S.members.length }, { name: "Nhà Bánh Bao", weekCoins: 250, members: 4 },
      ].map((r) => ({ ...r, avg: Math.round((r.weekCoins / r.members) * 10) / 10, mine: r.name === me }));
      return rows.sort((a, b) => b.avg - a.avg).map((r, i) => ({ ...r, rank: i + 1 }));
    },
    reviewRange: async (from, to) => {
      const t0 = today();
      const past = from < t0 ? demoHistory(S, from, to < t0 ? to : addDays(t0, -1)) : [];
      const now = from <= t0 && to >= t0 ? summarizeDay(S, t0) : [];
      return [...past, ...now];
    },
    tts: async () => null,
    startGarden: async (member) => { ruleStartGarden(S, member); },
    buySeed: async (member, species, slot) => { guardKid(); ruleBuySeed(S, member, species, slot); },
    buySlot: async (member) => { guardKid(); ruleBuySlot(S, member); },
    buyPot: async (member, item) => { guardKid(); ruleBuyPot(S, member, item); },
    sellPot: async (member, item) => { guardKid(); return ruleSellPot(S, member, item); },
    saveAlarm: async (a, take, oldAudioPath) => {
      if (!a.title.trim()) fail("empty_title");
      const id = a.id ?? uid();
      let audio = a.audio;
      if (take) { audio = { path: "demo:alarm:" + id + ":" + Date.now(), secs: take.secs, mime: take.mime }; recordings.set(audio.path, take.blob); }
      const next = { ...a, id, title: a.title.trim().slice(0, 40), audio };
      const i = S.alarms.findIndex((x) => x.id === id);
      if (i >= 0) S.alarms[i] = next; else { if (S.alarms.length >= 20) fail("too_many_alarms"); S.alarms.push(next); }
      S.alarms.sort((x, y) => x.at.localeCompare(y.at));
      if (oldAudioPath && oldAudioPath !== audio?.path) recordings.delete(oldAudioPath);
    },
    ackAlarm: async () => {},
    setAlarmEnabled: async (id, enabled) => { const a = S.alarms.find((x) => x.id === id); if (a) a.enabled = enabled; },
    deleteAlarm: async (id) => { const a = S.alarms.find((x) => x.id === id); if (a?.audio) recordings.delete(a.audio.path); S.alarms = S.alarms.filter((x) => x.id !== id); },
    setPot: async (plant, item) => { ruleSetPot(S, plant, item); },
    waterPlant: async (plant, amount) => { guardKid(); refreshEarned(S); return ruleWater(S, plant, amount); },
    harvestPlant: async (plant) => { guardKid(); return ruleHarvest(S, plant); },
    saveGardenSettings: async (enabled, cap) => { S.settings.gardenEnabled = enabled; S.settings.gardenCap = cap; },
    sendPraise: async (from, to, body, voice, audio) => {
      const text = body.trim().slice(0, 400);
      if (!text && !audio) fail("empty_body");
      if (S.members.find((m) => m.id === from)?.role !== "parent") fail("invalid_member");
      const id = uid();
      let a: { path: string; secs: number; mime: string } | undefined;
      if (audio) { a = { path: "demo:" + id, secs: audio.secs, mime: audio.mime }; recordings.set(a.path, audio.blob); }
      S.praises = [{ id, from, to, body: text, at: new Date().toISOString(), heard: false, voice, audio: a }, ...S.praises].slice(0, 50);
    },
    praiseAudio: async (path) => recordings.get(path) ?? null,
    markPraiseHeard: async (id) => { const p = S.praises.find((x) => x.id === id); if (p) p.heard = true; },
    deletePraise: async (id) => { S.praises = S.praises.filter((p) => p.id !== id); },
    pushSubscribe: async () => {},
    pushUnsubscribe: async () => {},
    notify: async () => 0,
    weekReport: async (offset): Promise<WeekReport> => {
      // Bản dùng thử không có lịch sử: chia đều Ủn tuần này / tuần trước cho các ngày đã qua
      const start = weekStartOf(offset);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const elapsed = offset === 0 ? Math.max(1, days.filter((d) => d <= today()).length) : offset === -1 ? 7 : 0;
      const rows = S.members.flatMap((m) =>
        days.map((day, i) => {
          const total = offset === 0 ? S.week[m.id] || 0 : offset === -1 ? S.lastWeek[m.id] || 0 : 0;
          const earned = i < elapsed ? Math.round(total / elapsed) : 0;
          return { member: m.id, day, earned, spent: 0, tasks: earned ? Math.max(1, Math.round(earned / 15)) : 0 };
        }),
      );
      return { start, days, rows };
    },
  };
}
