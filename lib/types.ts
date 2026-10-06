import type { IconName } from "@/components/Icon";

export type Role = "parent" | "kid";
export type Slot = "sang" | "chieu" | "toi";
export type Tier = "nho" | "vua" | "lon";
export type Who = "kid" | "together" | "parent";
export type SubStatus = "pending" | "approved" | "redo";

export type Member = {
  id: string;
  name: string;
  role: Role;
  color: string;
  soft: string;
  initial: string;
  avatar?: string; // biểu tượng (emoji) do bố mẹ chọn; trống thì dùng chữ cái đầu
  label?: string;
};

export type Task = {
  id: string;
  title: string;
  icon: IconName;
  coins: number;
  slot: Slot;
  who: Who;
  /** Các bé được giao (kid/together); không có = tất cả các bé */
  kids?: string[];
  /** Bố/mẹ được giao (parent) hoặc cùng làm (together); không có = tất cả bố mẹ */
  parents?: string[];
  due?: string; // hạn hoàn thành trong ngày, dạng "HH:mm"
  est?: number; // dự kiến mất bao nhiêu phút
  selfCheck?: boolean; // bố mẹ tự đánh dấu xong, không cần con chấm, không có Ủn
  oneOff?: boolean; // chỉ làm một lần, không nằm trong kho việc
  repeat: number; // mặt nạ bit theo thứ: bit0 = Thứ Hai ... bit6 = Chủ nhật (127 = mỗi ngày, 0 = không lặp)
  bg: string;
};

export type Submission = {
  id: string;
  member: string;
  task: string;
  date: string;
  status: SubStatus;
  time: string;
  by?: string;
  sticker?: string;
  seen?: boolean;
};

export type Reward = { id: string; title: string; icon: IconName; cost: number; tier: Tier; bg: string };
export type Promise_ = { id: string; member: string; reward: string; status: "promised" | "done"; at: string };

export type Challenge = {
  id: string;
  a: string;
  b: string;
  title: string;
  target: number;
  prog: Record<string, number>;
  prize: string;
  daysLeft: number;
  linkedTask?: string; // việc tốt làm kèo tự +1 khi được gật đầu
};

/** Lời khen của bố mẹ gửi cho con; máy của con đọc thành tiếng */
export type Praise = { id: string; from: string; to: string; body: string; at: string; heard: boolean; voice: "f" | "m"; /** Lời khen bằng giọng ghi âm của bố mẹ (nếu có) */ audio?: { path: string; secs: number; mime: string } };

export type SpeciesId = "hy_vong" | "cham_chi" | "ngoan" | "ky_luat" | "dung_cam" | "kien_nhan";
export type PotId = "dat" | "xanh" | "hong" | "sao" | "cau_vong" | "kitty" | "meo";
/** Một cây trong vườn của bé */
export type Plant = { id: string; species: SpeciesId; slot: number; watered: number; poured: number; harvests: number; pot: PotId; lastWateredAt: string | null; plantedAt: string };
/** Khu vườn của một bé: earned = số giọt nước đã kiếm, spentWeek = Ủn đã chi cho vườn tuần này */
export type Garden = { member: string; startedAt: string; slots: number; earned: number; spentWeek: number; plants: Plant[]; items: string[] };

export type Settings = { start: string; end: string; minutes: number; enforce: boolean; leaderboard: boolean; limitEnabled: boolean; gardenEnabled: boolean; gardenCap: number };

export type Data = {
  familyName: string;
  members: Member[];
  /** Ghi đè lịch theo ngày: taskId → ngày (YYYY-MM-DD) → có giao hay không */
  overrides: Record<string, Record<string, boolean>>;
  coins: Record<string, number>; // số Ủn đang có (ví)
  week: Record<string, number>; // Ủn kiếm được tuần này
  lastWeek: Record<string, number>; // Ủn kiếm được tuần trước
  streak: Record<string, number>;
  tasks: Task[];
  subs: Submission[];
  rewards: Reward[];
  promises: Promise_[];
  jar: { id: string; goal: string; target: number; contrib: Record<string, number>; reached: boolean };
  /** Những lần góp hũ gần đây của hũ hiện tại */
  jarLog: { member: string; amount: number; at: string }[];
  challenges: Challenge[];
  /** Lời khen gần nhất (mới nhất trước) */
  praises: Praise[];
  /** Khu vườn của từng bé (đã bắt đầu chơi) */
  gardens: Record<string, Garden>;
  settings: Settings;
};

export type KidScreen = "home" | "missions" | "arena" | "garden" | "shop" | "jar" | "judge" | "summary";
export type Screen = "profiles" | "sleep" | "timeout" | "parent" | KidScreen;
export type ParentTab = "approve" | "mine" | "plan" | "jar" | "promises" | "report" | "tasks" | "rewards" | "challenges" | "members" | "settings" | "praise" | "gardens";

export type Celebrate =
  | { type: "coins"; ids: string[] }
  | { type: "redeem"; title: string }
  | { type: "jar" }
  | { type: "harvest"; title: string; amount: number; golden: boolean };

export type UIState = {
  member: string | null;
  screen: Screen;
  pinFor: string | null;
  pin: string;
  pinErr: boolean;
  toast: { msg: string; id: number } | null;
  celebrate: Celebrate | null;
  timerEnd: number | null;
  ptab: ParentTab;
  judgeFor: string;
  sticker: Record<string, string>;
  /** Ngăn đang mở trong tab Vườn của bé */
  gtab: "garden" | "shop" | "race";
};

export type AppState = { S: Data; U: UIState };
