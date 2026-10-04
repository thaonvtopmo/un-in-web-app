import { hhmm, partnersOf, today } from "./data";
import type { Data } from "./types";

/**
 * Quy tắc nghiệp vụ dạng hàm thuần trên Data.
 * Dùng cho (1) cập nhật giao diện ngay lập tức trong lúc chờ server và (2) bản dùng thử.
 * Server vẫn là nơi quyết định cuối cùng; khi server trả về, dữ liệu được tải lại và thay thế.
 */
let seq = 0;
const tmp = () => `tmp-${Date.now()}-${++seq}`;

export const addCoins = (S: Data, id: string, n: number, earned = true) => {
  S.coins[id] = (S.coins[id] || 0) + n;
  if (earned) S.week[id] = (S.week[id] || 0) + n;
};

/** Áp kế hoạch của một ngày: enabled = null nghĩa là bỏ ghi đè (theo lịch lặp) */
export function rulePlan(S: Data, day: string, items: { task: string; enabled: boolean | null }[]) {
  for (const it of items) {
    const m = (S.overrides[it.task] ??= {});
    if (it.enabled === null) delete m[day];
    else m[day] = it.enabled;
  }
}

export function ruleSubmit(S: Data, member: string, task: string) {
  const ex = S.subs.filter((s) => s.member === member && s.task === task && s.date === today()).pop();
  if (!ex) S.subs.push({ id: tmp(), member, task, date: today(), status: "pending", time: hhmm() });
  else if (ex.status === "redo") { ex.status = "pending"; ex.time = hhmm(); }
}

export function ruleApprove(S: Data, sid: string, reviewer: string, sticker: string) {
  const s = S.subs.find((x) => x.id === sid);
  const t = s && S.tasks.find((x) => x.id === s.task);
  if (!s || !t || s.status === "approved") return;
  s.status = "approved"; s.by = reviewer; s.sticker = sticker || "Giỏi quá!"; s.seen = false;
  addCoins(S, s.member, t.coins);
  partnersOf(S, t).forEach((pid) => addCoins(S, pid, t.coins));
  S.challenges.forEach((c) => {
    if (c.linkedTask === t.id && (c.a === s.member || c.b === s.member) && c.prog[s.member] < c.target) c.prog[s.member]++;
  });
}

export function ruleRevoke(S: Data, sid: string) {
  const s = S.subs.find((x) => x.id === sid);
  const t = s && S.tasks.find((x) => x.id === s.task);
  if (!s || !t || s.status !== "approved") return;
  s.status = "pending"; s.by = undefined; s.sticker = undefined; s.seen = false;
  addCoins(S, s.member, -t.coins);
  partnersOf(S, t).forEach((pid) => addCoins(S, pid, -t.coins));
  S.challenges.forEach((c) => {
    if (c.linkedTask === t.id && (c.a === s.member || c.b === s.member) && c.prog[s.member] > 0) c.prog[s.member]--;
  });
}

export function ruleRemind(S: Data, sid: string) {
  const s = S.subs.find((x) => x.id === sid);
  if (s && s.status === "pending") s.status = "redo"; // không trừ Ủn
}

/** Con chấm / bỏ chấm một mục checklist của bố mẹ */
export function ruleJudge(S: Data, parent: string, tid: string, kid: string) {
  const t = S.tasks.find((x) => x.id === tid);
  if (!t) return;
  const ex = S.subs.filter((s) => s.member === parent && s.task === tid && s.date === today()).pop();
  if (ex && ex.status === "approved") {
    S.subs = S.subs.filter((s) => s.id !== ex.id);
    addCoins(S, parent, -t.coins);
  } else {
    S.subs.push({ id: tmp(), member: parent, task: tid, date: today(), status: "approved", time: hhmm(), by: kid, seen: true });
    addCoins(S, parent, t.coins);
  }
}

export function ruleRedeem(S: Data, member: string, rid: string) {
  const r = S.rewards.find((x) => x.id === rid);
  if (!r) return;
  S.coins[member] = (S.coins[member] || 0) - r.cost;
  S.promises.unshift({ id: tmp(), member, reward: rid, status: "promised", at: "Bố mẹ sẽ hẹn ngày" });
}

export function ruleCancelPromise(S: Data, pid: string) {
  const p = S.promises.find((x) => x.id === pid);
  const r = p && S.rewards.find((x) => x.id === p.reward);
  if (!p || p.status !== "promised") return;
  if (r) S.coins[p.member] = (S.coins[p.member] || 0) + r.cost; // hoàn đủ Ủn, không tính là Ủn kiếm được
  S.promises = S.promises.filter((x) => x.id !== pid);
}

export function ruleGive(S: Data, member: string, amount: number): boolean {
  S.coins[member] -= amount;
  S.jarLog.unshift({ member, amount, at: new Date().toISOString() });
  S.jar.contrib[member] = (S.jar.contrib[member] || 0) + amount;
  const total = Object.values(S.jar.contrib).reduce((a, b) => a + b, 0);
  if (total >= S.jar.target) { S.jar.reached = true; return true; }
  return false;
}
