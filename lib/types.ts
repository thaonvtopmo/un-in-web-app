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
  label?: string;
};

export type Task = {
  id: string;
  title: string;
  icon: IconName;
  coins: number;
  slot: Slot;
  who: Who;
  partner?: string; // với "together": id bố/mẹ hoặc "all"
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

export type Settings = { start: string; end: string; minutes: number; enforce: boolean; leaderboard: boolean };

export type Data = {
  familyName: string;
  members: Member[];
  coins: Record<string, number>; // số Ủn đang có (ví)
  week: Record<string, number>; // Ủn kiếm được tuần này
  lastWeek: Record<string, number>; // Ủn kiếm được tuần trước
  streak: Record<string, number>;
  tasks: Task[];
  subs: Submission[];
  rewards: Reward[];
  promises: Promise_[];
  jar: { id: string; goal: string; target: number; contrib: Record<string, number>; reached: boolean };
  challenges: Challenge[];
  settings: Settings;
};

export type KidScreen = "home" | "missions" | "arena" | "shop" | "jar" | "judge" | "summary";
export type Screen = "profiles" | "sleep" | "timeout" | "parent" | KidScreen;
export type ParentTab = "approve" | "promises" | "report" | "tasks" | "rewards" | "challenges" | "members" | "settings";

export type Celebrate =
  | { type: "coins"; ids: string[] }
  | { type: "redeem"; title: string }
  | { type: "jar" };

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
};

export type AppState = { S: Data; U: UIState };
