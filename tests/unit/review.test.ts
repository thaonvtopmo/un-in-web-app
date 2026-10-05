import { describe, expect, it } from "vitest";
import { addDays, today } from "@/lib/data";
import { bucket, demoHistory, digestText, rateOf, summarizeDay, topMissed, totalsOf, type DaySummary } from "@/lib/review";
import { splitSentences } from "@/lib/voice";
import { familyFixture } from "./fixture";

const sub = (member: string, task: string, status: "approved" | "pending" | "redo", time = "08:00", date = today()) =>
  ({ id: `${member}-${task}`, member, task, date, status, time });

describe("tổng kết ngày", () => {
  it("chưa làm gì: mọi việc được giao đều là chưa làm", () => {
    const S = familyFixture();
    const bin = summarizeDay(S, today()).find((r) => r.member === "bin")!;
    expect(bin.planned).toBe(3); // Dậy sớm + 2 việc làm cùng
    expect(bin.done).toBe(0);
    expect(bin.missed).toEqual(["Dậy sớm", "Tưới cây cùng Bố", "Ăn tối cả nhà"]);
    expect(bin.stickers).toEqual([]);
  });

  it("việc đã gật đầu và việc đang chờ gật đầu đều tính là đã làm", () => {
    const S = familyFixture();
    S.subs.push(sub("bin", "t1", "approved"), sub("bin", "g1", "pending"));
    const bin = summarizeDay(S, today()).find((r) => r.member === "bin")!;
    expect(bin.done).toBe(2);
    expect(bin.doneTitles).toEqual(["Dậy sớm", "Tưới cây cùng Bố"]);
    expect(bin.missed).toEqual(["Ăn tối cả nhà"]);
  });

  it("làm lại thì vẫn là việc chưa làm tốt, ghi chú (làm lại)", () => {
    const S = familyFixture();
    S.subs.push(sub("bin", "t1", "redo"));
    const bin = summarizeDay(S, today()).find((r) => r.member === "bin")!;
    expect(bin.missed).toContain("Dậy sớm (làm lại)");
    expect(bin.done).toBe(0);
  });

  it("làm hết thì nhận star, chamchi và đủ ba buổi", () => {
    const S = familyFixture();
    S.subs.push(sub("bin", "t1", "approved"), sub("bin", "g1", "approved"), sub("bin", "g2", "approved"));
    const bin = summarizeDay(S, today()).find((r) => r.member === "bin")!;
    expect(bin.stickers).toEqual(["star", "chamchi", "sang", "chieu", "toi"]);
    expect(bin.missed).toEqual([]);
  });

  it("xong trọn một buổi nhưng chưa hết ngày chỉ nhận sticker buổi đó", () => {
    const S = familyFixture();
    S.subs.push(sub("bin", "t1", "approved"));
    const bin = summarizeDay(S, today()).find((r) => r.member === "bin")!;
    expect(bin.stickers).toEqual(["sang"]);
  });

  it("việc có hạn: nộp trước hạn thì có dunggio, nộp muộn thì không", () => {
    const S = familyFixture();
    S.tasks[0].due = "07:00";
    S.subs.push(sub("bin", "t1", "approved", "06:50"));
    expect(summarizeDay(S, today()).find((r) => r.member === "bin")!.stickers).toContain("dunggio");
    S.subs[0].time = "07:30";
    expect(summarizeDay(S, today()).find((r) => r.member === "bin")!.stickers).not.toContain("dunggio");
  });

  it("bố mẹ chỉ được tính các việc trong checklist bố mẹ; việc giao riêng chỉ tính cho người được giao", () => {
    const S = familyFixture();
    S.tasks.push({ id: "m1", title: "Việc riêng của Mẹ", icon: "check", coins: 0, slot: "toi", who: "parent", parents: ["me"], selfCheck: true, repeat: 127, bg: "#fff" });
    const rows = summarizeDay(S, today());
    expect(rows.find((r) => r.member === "bo")!.planned).toBe(1);
    expect(rows.find((r) => r.member === "me")!.planned).toBe(2);
  });

  it("việc không có lịch hôm đó thì không tính", () => {
    const S = familyFixture();
    S.tasks[0].repeat = 0;
    expect(summarizeDay(S, today()).find((r) => r.member === "bin")!.planned).toBe(2);
  });
});

describe("gom số liệu", () => {
  const rows = (): DaySummary[] => [
    { member: "bin", day: "2026-03-01", planned: 4, done: 4, coins: 40, stickers: ["star", "chamchi"], doneTitles: [], missed: [] },
    { member: "bin", day: "2026-03-02", planned: 4, done: 2, coins: 20, stickers: [], doneTitles: [], missed: ["Đánh răng", "Dọn đồ (làm lại)"] },
    { member: "na", day: "2026-03-02", planned: 2, done: 1, coins: 10, stickers: ["sang"], doneTitles: [], missed: ["Đánh răng"] },
    { member: "bin", day: "2026-04-01", planned: 4, done: 3, coins: 30, stickers: ["chamchi"], doneTitles: [], missed: ["Đánh răng"] },
  ];

  it("tổng số việc, Ủn, ngày làm hết và sticker", () => {
    const t = totalsOf(rows());
    expect(t).toMatchObject({ planned: 14, done: 10, coins: 100, days: 4, perfectDays: 1 });
    expect(t.stickers).toEqual({ star: 1, chamchi: 2, sang: 1 });
    expect(rateOf(t)).toBeCloseTo(10 / 14);
    expect(totalsOf(rows(), "na").done).toBe(1);
  });

  it("việc bị bỏ sót nhiều nhất (gộp cả làm lại), xếp giảm dần", () => {
    expect(topMissed(rows(), 5)).toEqual([{ title: "Đánh răng", count: 3 }, { title: "Dọn đồ", count: 1 }]);
    expect(topMissed(rows(), 1)).toHaveLength(1);
    expect(topMissed(rows(), 5, "na")).toEqual([{ title: "Đánh răng", count: 1 }]);
  });

  it("gom theo tháng", () => {
    const m = bucket(rows(), (d) => d.slice(0, 7));
    expect([...m.keys()]).toEqual(["2026-03", "2026-04"]);
    expect(m.get("2026-03")!.done).toBe(7);
  });

  it("lịch sử mẫu của bản dùng thử ổn định giữa các lần gọi", () => {
    const S = familyFixture();
    const a = demoHistory(S, addDays(today(), -20), addDays(today(), -1));
    const b = demoHistory(S, addDays(today(), -20), addDays(today(), -1));
    expect(a).toEqual(b);
    expect(a.every((r) => r.done <= r.planned)).toBe(true);
  });
});

describe("thông báo tổng kết 21:00", () => {
  const kids = new Set(["bin", "na"]);
  const name = (id: string) => ({ bin: "Bin", na: "Na", bo: "Bố" }[id] ?? id);

  it("liệt kê từng bé và việc cần cố gắng", () => {
    const rows: DaySummary[] = [
      { member: "bin", day: "d", planned: 5, done: 5, coins: 50, stickers: ["star"], doneTitles: [], missed: [] },
      { member: "na", day: "d", planned: 5, done: 3, coins: 30, stickers: [], doneTitles: [], missed: ["Đánh răng", "Dọn đồ chơi"] },
      { member: "bo", day: "d", planned: 2, done: 0, coins: 0, stickers: [], doneTitles: [], missed: ["Họp"] },
    ];
    const m = digestText(rows, name, kids);
    expect(m.title).toBe("Tổng kết hôm nay");
    expect(m.body).toContain("Bin 5/5 việc ⭐");
    expect(m.body).toContain("Na 3/5 việc");
    expect(m.body).toContain("Đánh răng (Na)");
    expect(m.body).not.toContain("Họp");
  });

  it("cả nhà làm hết thì khen; không có việc thì nói rõ", () => {
    const ok: DaySummary[] = [{ member: "bin", day: "d", planned: 2, done: 2, coins: 20, stickers: [], doneTitles: [], missed: [] }];
    expect(digestText(ok, name, kids).body).toContain("Cả nhà làm rất tốt");
    expect(digestText([], name, kids).body).toContain("chưa có việc");
  });
});

describe("đọc lời khen", () => {
  it("chia thành từng câu và giữ dấu câu", () => {
    expect(splitSentences("Con giỏi lắm! Bố mẹ tự hào. Cố lên nhé")).toEqual(["Con giỏi lắm!", "Bố mẹ tự hào.", "Cố lên nhé"]);
  });
  it("câu quá dài được cắt theo từ, không câu nào dài quá 160 ký tự", () => {
    const long = Array.from({ length: 80 }, (_, i) => `từ${i}`).join(" ");
    const parts = splitSentences(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 160)).toBe(true);
    expect(parts.join(" ")).toBe(long);
  });
  it("văn bản trống không có câu nào", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});
