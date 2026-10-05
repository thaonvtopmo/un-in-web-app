import { addDays, dowIdx, taskOnDay } from "./data";
import type { Data, Slot } from "./types";

/** Tổng kết một người trong một ngày (cùng dạng với hàm review_range trên server) */
export type DaySummary = {
  member: string;
  day: string;
  planned: number;
  done: number;
  coins: number;
  stickers: string[];
  doneTitles: string[];
  missed: string[];
};

/** Sticker tặng tự động theo kết quả trong ngày */
export const STICKER_INFO: Record<string, { emoji: string; name: string; hint: string }> = {
  star: { emoji: "⭐", name: "Siêu sao", hint: "Làm hết mọi việc trong ngày" },
  chamchi: { emoji: "💪", name: "Chăm chỉ", hint: "Làm từ 3 việc trong ngày" },
  sang: { emoji: "🌅", name: "Trọn buổi sáng", hint: "Xong hết việc buổi sáng" },
  chieu: { emoji: "☀️", name: "Trọn buổi chiều", hint: "Xong hết việc buổi chiều" },
  toi: { emoji: "🌙", name: "Trọn buổi tối", hint: "Xong hết việc buổi tối" },
  dunggio: { emoji: "⏰", name: "Đúng giờ", hint: "Xong việc có hạn trước giờ hạn" },
};
export const STICKER_ORDER = ["star", "chamchi", "sang", "chieu", "toi", "dunggio"];
export const stickerInfo = (k: string) => STICKER_INFO[k] ?? { emoji: "🎖️", name: k, hint: "" };

const slotRank = (s: Slot) => (s === "sang" ? 1 : s === "chieu" ? 2 : 3);

/**
 * Bản chạy trong trình duyệt của compute_day (dùng cho bản dùng thử). Cùng luật với server:
 * "đã làm" gồm việc đã gật đầu và việc đang chờ gật đầu; sticker xem STICKER_INFO.
 */
export function summarizeDay(S: Pick<Data, "members" | "tasks" | "overrides" | "subs">, day: string): DaySummary[] {
  const out: DaySummary[] = [];
  for (const m of S.members) {
    const planned = S.tasks
      .filter((t) => taskOnDay(S as Data, t, day) && (
        (m.role === "kid" && t.who !== "parent" && (!t.kids || t.kids.includes(m.id))) ||
        (m.role === "parent" && t.who === "parent" && (!t.parents || t.parents.includes(m.id)))
      ))
      .sort((a, b) => slotRank(a.slot) - slotRank(b.slot) || a.title.localeCompare(b.title));
    if (!planned.length) continue;
    const rows = planned.map((t) => ({ t, s: S.subs.find((x) => x.member === m.id && x.task === t.id && x.date === day) }));
    const isDone = (r: (typeof rows)[number]) => r.s?.status === "approved" || r.s?.status === "pending";
    const done = rows.filter(isDone);
    const slots = (["sang", "chieu", "toi"] as Slot[]).filter((sl) => { const g = rows.filter((r) => r.t.slot === sl); return g.length > 0 && g.every(isDone); });
    const stickers = [
      planned.length >= 2 && done.length === planned.length ? "star" : "",
      done.length >= 3 ? "chamchi" : "",
      ...slots,
      done.some((r) => r.t.due && r.s && r.s.time <= (r.t.due as string)) ? "dunggio" : "",
    ].filter(Boolean);
    out.push({
      member: m.id, day, planned: planned.length, done: done.length,
      coins: S.subs.filter((x) => x.member === m.id && x.date === day && x.status === "approved").reduce((a, x) => a + (S.tasks.find((t) => t.id === x.task)?.coins ?? 0), 0),
      stickers, doneTitles: done.map((r) => r.t.title),
      missed: rows.filter((r) => !isDone(r)).map((r) => (r.s?.status === "redo" ? `${r.t.title} (làm lại)` : r.t.title)),
    });
  }
  return out;
}

/** Lịch sử mẫu cho bản dùng thử: cùng một ngày luôn ra cùng một kết quả */
export function demoHistory(S: Pick<Data, "members" | "tasks">, from: string, to: string): DaySummary[] {
  const out: DaySummary[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const seed = [...day].reduce((a, c) => a + c.charCodeAt(0), 0);
    S.members.forEach((m, mi) => {
      const mine = S.tasks.filter((t) => (m.role === "kid" ? t.who !== "parent" : t.who === "parent") && ((t.repeat >> dowIdx(day)) & 1) === 1);
      if (!mine.length) return;
      const r = (seed * (mi + 3) * 7919) % 100;
      const doneN = r < 20 ? mine.length : r < 75 ? Math.max(1, mine.length - (r % 3)) : Math.floor(mine.length / 2);
      const titles = mine.map((t) => t.title);
      out.push({
        member: m.id, day, planned: mine.length, done: doneN, coins: mine.slice(0, doneN).reduce((a, t) => a + t.coins, 0),
        stickers: [doneN === mine.length ? "star" : "", doneN >= 3 ? "chamchi" : "", doneN === mine.length ? "toi" : ""].filter(Boolean),
        doneTitles: titles.slice(0, doneN), missed: titles.slice(doneN),
      });
    });
  }
  return out;
}

/* ---------- Gom số liệu cho các màn Nhìn lại ---------- */
export type Totals = { planned: number; done: number; coins: number; stickers: Record<string, number>; days: number; perfectDays: number };

export function totalsOf(rows: DaySummary[], member?: string): Totals {
  const t: Totals = { planned: 0, done: 0, coins: 0, stickers: {}, days: 0, perfectDays: 0 };
  for (const r of rows) {
    if (member && r.member !== member) continue;
    t.planned += r.planned; t.done += r.done; t.coins += r.coins; t.days++;
    if (r.planned > 0 && r.done === r.planned) t.perfectDays++;
    for (const s of r.stickers) t.stickers[s] = (t.stickers[s] ?? 0) + 1;
  }
  return t;
}

export const rateOf = (t: { planned: number; done: number }) => (t.planned ? t.done / t.planned : 0);

/** Việc hay bị bỏ lỡ nhất (bỏ chữ "(làm lại)"), kèm số lần */
export function topMissed(rows: DaySummary[], n = 5, member?: string): { title: string; count: number }[] {
  const c = new Map<string, number>();
  for (const r of rows) {
    if (member && r.member !== member) continue;
    for (const m of r.missed) { const k = m.replace(/ \(làm lại\)$/, ""); c.set(k, (c.get(k) ?? 0) + 1); }
  }
  return [...c.entries()].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, n);
}

/** Gom theo ngày hoặc theo tháng: dùng cho lịch nhiệt (tháng) và biểu đồ cột (năm) */
export function bucket(rows: DaySummary[], key: (day: string) => string): Map<string, Totals> {
  const groups = new Map<string, DaySummary[]>();
  for (const r of rows) { const k = key(r.day); (groups.get(k) ?? groups.set(k, []).get(k)!).push(r); }
  return new Map([...groups.entries()].map(([k, v]) => [k, totalsOf(v)]));
}

/** Câu nhắc ngắn cho thông báo tổng kết 21:00 */
export function digestText(rows: DaySummary[], name: (id: string) => string, kids: Set<string>): { title: string; body: string } {
  const kidRows = rows.filter((r) => kids.has(r.member) && r.planned > 0);
  if (!kidRows.length) return { title: "Tổng kết hôm nay", body: "Hôm nay chưa có việc nào được giao cho các con." };
  const lines = kidRows.map((r) => `${name(r.member)} ${r.done}/${r.planned} việc${r.stickers.length ? ` ${r.stickers.map((s) => stickerInfo(s).emoji).join("")}` : ""}`);
  const missed = kidRows.flatMap((r) => r.missed.map((m) => `${m} (${name(r.member)})`)).slice(0, 3);
  return {
    title: "Tổng kết hôm nay",
    body: `${lines.join(" · ")}.${missed.length ? ` Cần cố gắng: ${missed.join(", ")}.` : " Cả nhà làm rất tốt!"}`,
  };
}
