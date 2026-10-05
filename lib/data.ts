import type { Data, Member, Reward, Slot, Task, Tier, Submission } from "./types";

export const pad = (n: number) => String(n).padStart(2, "0");
const VN = "Asia/Ho_Chi_Minh";
/** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD), không phụ thuộc múi giờ máy */
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: VN }).format(new Date());
/** Cộng/trừ ngày cho chuỗi YYYY-MM-DD */
export const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const hhmmOf = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: VN, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
export const hhmm = () => hhmmOf(new Date());

export const SLOTS: Record<Slot, { label: string; color: string }> = {
  sang: { label: "BUỔI SÁNG", color: "#B45309" },
  chieu: { label: "BUỔI CHIỀU", color: "#0F766E" },
  toi: { label: "BUỔI TỐI", color: "#5B3FD1" },
};
export const TIERS: Record<Tier, { label: string; color: string }> = {
  nho: { label: "PHIẾU NHỎ · mỗi ngày", color: "#B45309" },
  vua: { label: "PHIẾU VỪA · mỗi tuần", color: "#0F766E" },
  lon: { label: "PHIẾU LỚN · mỗi tháng", color: "#5B3FD1" },
};
export const SLOT_SHORT: Record<Slot, string> = { sang: "Sáng", chieu: "Chiều", toi: "Tối" };
export const TIER_SHORT: Record<Tier, string> = { nho: "Nhỏ", vua: "Vừa", lon: "Lớn" };
export const STICKERS = ["Giỏi quá!", "Bố mẹ tự hào!", "Cố lên nhé!", "Siêu sao!"];
export const BGS = ["#FFE08A", "#C9F2E8", "#FFD9C2", "#FFD3E3", "#DCD3FF"];

/** Dữ liệu mẫu (giống bản prototype). Sau này thay bằng dữ liệu từ Supabase. */
export const DEMO_PIN = "1234";

export function seedData(): Data {
  const TODAY = today();
  return {
    familyName: "Nhà dùng thử",
    overrides: {},
    members: [
      { id: "bo", name: "Bố", role: "parent", color: "#FFB27A", soft: "#FFE8D6", initial: "Bố" },
      { id: "me", name: "Mẹ", role: "parent", color: "#FF9CC2", soft: "#FFE3EE", initial: "Mẹ" },
      { id: "bin", name: "Bin", role: "kid", color: "#3DD6B5", soft: "#D9F7EF", initial: "B", label: "Con lớn" },
      { id: "na", name: "Na", role: "kid", color: "#B9A6FF", soft: "#EDE7FF", initial: "N", label: "Con nhỏ" },
    ],
    coins: { bo: 260, me: 290, bin: 320, na: 150 },
    week: { bo: 260, me: 290, bin: 320, na: 150 },
    lastWeek: { bo: 240, me: 300, bin: 260, na: 110 },
    streak: { bin: 5, na: 3 },
    tasks: [
      { id: "t1", title: "Dậy trước 6h30", icon: "sun", coins: 20, slot: "sang", who: "kid", repeat: 127, bg: "#FFE08A" },
      { id: "t2", title: "Đi học đúng giờ", icon: "bag", coins: 15, slot: "sang", who: "kid", repeat: 127, bg: "#C9F2E8" },
      { id: "t3", title: "Ăn đúng giờ", icon: "bowl", coins: 10, slot: "chieu", who: "kid", repeat: 127, bg: "#FFD9C2" },
      { id: "t4", title: "Chăm em / giúp bố mẹ", icon: "heart", coins: 25, slot: "chieu", who: "kid", repeat: 127, bg: "#FFD3E3" },
      { id: "t5", title: "Nghe lời bố mẹ", icon: "ear", coins: 15, slot: "toi", who: "kid", repeat: 127, bg: "#FFE08A" },
      { id: "t6", title: "Ngủ trước 21h", icon: "moon", coins: 30, slot: "toi", who: "kid", repeat: 127, bg: "#DCD3FF" },
      { id: "g1", title: "Cùng bố tưới cây", icon: "tree", coins: 20, slot: "chieu", who: "together", parents: ["bo"], repeat: 127, bg: "#C9F2E8" },
      { id: "g2", title: "Cùng mẹ dọn đồ chơi", icon: "balls", coins: 20, slot: "toi", who: "together", parents: ["me"], repeat: 127, bg: "#FFD3E3" },
      { id: "g3", title: "Cả nhà ăn tối không điện thoại", icon: "phone", coins: 30, slot: "toi", who: "together", repeat: 127, bg: "#FFE08A" },
      { id: "p1", title: "Không lướt điện thoại khi ăn", icon: "phone", coins: 15, slot: "toi", who: "parent", repeat: 127, bg: "#FFD3E3" },
      { id: "p2", title: "Đọc truyện cho con", icon: "book", coins: 15, slot: "toi", who: "parent", repeat: 127, bg: "#DCD3FF" },
      { id: "p3", title: "Về nhà trước 19h", icon: "home", coins: 10, slot: "chieu", who: "parent", repeat: 127, bg: "#C9F2E8" },
      { id: "p4", title: "Chơi với con 30 phút", icon: "balls", coins: 20, slot: "toi", who: "parent", repeat: 127, bg: "#FFE08A" },
    ],
    subs: [
      { id: "s1", member: "bin", task: "t1", date: TODAY, status: "approved", time: "06:20", by: "me", sticker: "Giỏi quá!", seen: true },
      { id: "s2", member: "bin", task: "t2", date: TODAY, status: "approved", time: "07:05", by: "me", sticker: "Bố mẹ tự hào!", seen: false },
      { id: "s3", member: "bin", task: "t3", date: TODAY, status: "pending", time: "18:40" },
      { id: "s4", member: "na", task: "t1", date: TODAY, status: "pending", time: "06:45" },
      { id: "s5", member: "na", task: "t5", date: TODAY, status: "approved", time: "19:00", by: "bo", sticker: "Siêu sao!", seen: true },
    ],
    rewards: [
      { id: "r1", title: "Cùng mẹ nấu món con thích", icon: "bowl", cost: 30, tier: "nho", bg: "#FFD9C2" },
      { id: "r2", title: "Bố đọc thêm 1 truyện", icon: "book", cost: 40, tier: "nho", bg: "#DCD3FF" },
      { id: "r3", title: "Cùng bố mẹ đi nhà bóng", icon: "balls", cost: 180, tier: "vua", bg: "#FFD3E3" },
      { id: "r4", title: "Cả nhà đi công viên", icon: "tree", cost: 250, tier: "vua", bg: "#C9F2E8" },
      { id: "r5", title: "Cả nhà đi sở thú", icon: "paw", cost: 800, tier: "lon", bg: "#FFE08A" },
      { id: "r6", title: "Cả nhà đi dã ngoại", icon: "tent", cost: 1000, tier: "lon", bg: "#C9F2E8" },
    ],
    promises: [{ id: "pr1", member: "bin", reward: "r3", status: "promised", at: "Chủ nhật này" }],
    jar: { id: "jar1", goal: "Cả nhà đi Sở thú", target: 500, contrib: { bo: 120, me: 100, bin: 80, na: 40 }, reached: false },
    jarLog: [
      { member: "bin", amount: 20, at: new Date(Date.now() - 3600_000).toISOString() },
      { member: "bo", amount: 50, at: new Date(Date.now() - 86400_000).toISOString() },
    ],
    challenges: [
      {
        id: "c1", a: "bo", b: "bin", title: "Ai ngủ trước 21h đủ 5 ngày?", target: 5,
        prog: { bo: 3, bin: 4 }, prize: "Người thắng được chọn phim tối thứ Bảy", daysLeft: 3,
      },
    ],
    praises: [],
    settings: { start: "19:30", end: "19:45", minutes: 10, enforce: false, leaderboard: true, limitEnabled: false },
  };
}

/* ---------- Helper đọc dữ liệu ---------- */
const DELETED_TASK: Task = { id: "", title: "(đã xoá)", coins: 0, icon: "star", slot: "sang", who: "kid", repeat: 127, bg: "#eee" };

/* ---------- Lịch việc theo ngày ---------- */
/** Thứ trong tuần của một ngày: 0 = Thứ Hai ... 6 = Chủ nhật */
export const dowIdx = (ymd: string) => (new Date(ymd + "T00:00:00Z").getUTCDay() + 6) % 7;
export const DOW_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const REPEAT_ALL = 127;
export const REPEAT_WEEKDAYS = 31; // T2–T6
export const REPEAT_WEEKEND = 96; // T7, CN
/** Việc này có được giao vào ngày đó không: ghi đè của ngày nếu có, không thì theo lịch lặp */
export const taskOnDay = (S: Data, t: Task, ymd: string): boolean => S.overrides[t.id]?.[ymd] ?? ((t.repeat >> dowIdx(ymd)) & 1) === 1;
export function repeatLabel(mask: number): string {
  if (mask === REPEAT_ALL) return "Mỗi ngày";
  if (mask === REPEAT_WEEKDAYS) return "T2–T6";
  if (mask === REPEAT_WEEKEND) return "Cuối tuần";
  if (mask === 0) return "Chỉ ngày được chọn";
  return DOW_SHORT.filter((_, i) => (mask >> i) & 1).join(", ");
}

/** Biểu tượng avatar bố mẹ chọn cho từng người */
export const AVATARS = ["🐷", "🐶", "🐱", "🐰", "🦊", "🐼", "🐯", "🦁", "🐸", "🐵", "🐨", "🐻", "🦄", "🐥", "🐢", "🐙", "🦖", "🚀", "⚽", "🌈"];

export const mem = (S: Data, id: string): Member => S.members.find((m) => m.id === id) ?? S.members[0];
export const taskOf = (S: Data, id: string): Task => S.tasks.find((t) => t.id === id) ?? DELETED_TASK;
export const rewardOf = (S: Data, id: string): Reward | { title: string } =>
  S.rewards.find((r) => r.id === id) ?? { title: "(đã xoá)" };
/** Việc của con được giao cho ngày `day` (mặc định hôm nay) */
/** Việc của con được giao cho ngày `day` (mặc định hôm nay); có `kidId` thì chỉ lấy việc được giao cho bé đó */
export const kidTasks = (S: Data, day = today(), kidId?: string) =>
  S.tasks.filter((t) => (t.who === "kid" || t.who === "together") && taskOnDay(S, t, day) && (!kidId || !t.kids || t.kids.includes(kidId)));
/** Mục checklist của bố mẹ mà CON chấm Đạt, được giao cho ngày `day`; có `parentId` thì chỉ lấy mục của người đó */
export const parentTasks = (S: Data, day = today(), parentId?: string) =>
  S.tasks.filter((t) => t.who === "parent" && !t.selfCheck && taskOnDay(S, t, day) && (!parentId || !t.parents || t.parents.includes(parentId)));
/** Mọi việc của một bố/mẹ trong ngày (cả việc tự đánh dấu lẫn việc con chấm), xếp theo hạn rồi theo buổi */
export const myTasks = (S: Data, parentId: string, day = today()) =>
  S.tasks
    .filter((t) => t.who === "parent" && taskOnDay(S, t, day) && (!t.parents || t.parents.includes(parentId)))
    .sort((a, b) => (a.due ?? "99:99").localeCompare(b.due ?? "99:99") || ["sang", "chieu", "toi"].indexOf(a.slot) - ["sang", "chieu", "toi"].indexOf(b.slot));
/** Đã quá hạn chưa (chỉ tính cho hôm nay) */
export const isOverdue = (t: Task, day: string, done: boolean) => !done && day === today() && Boolean(t.due) && hhmm() > (t.due as string);
/** "Trước 18:00 · ~30 phút" */
export const timeInfo = (t: Task) => [t.due ? `trước ${t.due}` : "", t.est ? `~${t.est} phút` : ""].filter(Boolean).join(" · ");
/** Bố/mẹ được cộng Ủn khi con làm xong một việc làm-cùng-nhau */
export const partnersOf = (S: Data, t: Task): string[] =>
  t.who !== "together" ? [] : S.members.filter((m) => m.role === "parent" && (!t.parents || t.parents.includes(m.id))).map((m) => m.id);
export const partnerLabel = (S: Data, t: Task) => {
  const ps = partnersOf(S, t);
  const all = S.members.filter((m) => m.role === "parent").length;
  return ps.length === 0 || ps.length === all ? "cả nhà" : ps.map((id) => mem(S, id).name).join(" và ");
};
/** Việc này giao cho ai (để hiện trong danh sách) */
export function assigneeLabel(S: Data, t: Task): string {
  const kids = S.members.filter((m) => m.role === "kid");
  const parents = S.members.filter((m) => m.role === "parent");
  const names = (list: typeof kids, sel?: string[]) => (!sel || sel.length === list.length ? null : list.filter((m) => sel.includes(m.id)).map((m) => m.name).join(", "));
  if (t.who === "parent") return names(parents, t.parents) ?? "cả bố mẹ";
  const k = names(kids, t.kids) ?? "các con";
  if (t.who === "kid") return k;
  const p = names(parents, t.parents);
  return !t.kids && !p ? "cả nhà" : `${k} + ${p ?? "bố mẹ"}`;
}
export const subOf = (S: Data, k: string, tid: string): Submission | undefined =>
  S.subs.filter((s) => s.member === k && s.task === tid && s.date === today()).pop();
export const jarTotal = (S: Data) => Object.values(S.jar.contrib).reduce((a, b) => a + b, 0);
export const kidPending = (S: Data) => S.subs.filter((s) => s.status === "pending" && S.members.find((m) => m.id === s.member)?.role === "kid");

export const fmt = (ms: number) => {
  const t = Math.ceil(Math.max(0, ms) / 1000);
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
};
export const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export const inWindow = (S: Data) => {
  const d = new Date();
  const n = d.getHours() * 60 + d.getMinutes();
  return n >= toMin(S.settings.start) && n <= toMin(S.settings.end);
};


/** Heo Ủn lớn lên theo chuỗi ngày liền (mỗi ngày cần ≥3 việc tốt được gật đầu) */
export const PIG_LEVELS: { level: 1 | 2 | 3 | 4; days: number; name: string }[] = [
  { level: 1, days: 0, name: "Ủn Con" },
  { level: 2, days: 3, name: "Ủn Nơ" },
  { level: 3, days: 7, name: "Ủn Mũ" },
  { level: 4, days: 14, name: "Ủn Vua" },
];
export function pigLevelOf(streak: number) {
  const cur = [...PIG_LEVELS].reverse().find((l) => streak >= l.days) ?? PIG_LEVELS[0];
  const next = PIG_LEVELS.find((l) => l.days > streak);
  return { ...cur, next: next ? { name: next.name, daysLeft: next.days - streak } : null };
}
