import type { Data } from "@/lib/types";

/** Gia đình nhỏ để thử quy tắc: Bố, Mẹ, Bin */
export function familyFixture(): Data {
  return {
    familyName: "Nhà thử",
    overrides: {},
    members: [
      { id: "bo", name: "Bố", role: "parent", color: "#FFB27A", soft: "#FFB27A33", initial: "Bố" },
      { id: "me", name: "Mẹ", role: "parent", color: "#FF9CC2", soft: "#FF9CC233", initial: "Mẹ" },
      { id: "bin", name: "Bin", role: "kid", color: "#3DD6B5", soft: "#3DD6B533", initial: "B" },
    ],
    coins: { bo: 0, me: 0, bin: 0 },
    week: { bo: 0, me: 0, bin: 0 },
    lastWeek: { bo: 0, me: 0, bin: 0 },
    streak: { bin: 0 },
    tasks: [
      { id: "t1", title: "Dậy sớm", icon: "sun", coins: 20, slot: "sang", who: "kid", repeat: 127, bg: "#fff" },
      { id: "g1", title: "Tưới cây cùng Bố", icon: "tree", coins: 30, slot: "chieu", who: "together", parents: ["bo"], repeat: 127, bg: "#fff" },
      { id: "g2", title: "Ăn tối cả nhà", icon: "bowl", coins: 10, slot: "toi", who: "together", repeat: 127, bg: "#fff" },
      { id: "p1", title: "Đọc truyện", icon: "book", coins: 15, slot: "toi", who: "parent", repeat: 127, bg: "#fff" },
    ],
    subs: [],
    rewards: [{ id: "r1", title: "Đi nhà bóng", icon: "balls", cost: 30, tier: "nho", bg: "#fff" }],
    promises: [],
    jar: { id: "j", goal: "Sở thú", target: 500, contrib: { bo: 0, me: 0, bin: 0 }, reached: false },
    jarLog: [],
    challenges: [],
    settings: { start: "19:30", end: "19:45", minutes: 10, enforce: false, leaderboard: true, limitEnabled: false },
  };
}
