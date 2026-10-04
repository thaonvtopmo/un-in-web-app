import { describe, expect, it } from "vitest";
import { streakOf, weekStartOf } from "@/lib/backend";
import { addDays, fmt, pigLevelOf, toMin } from "@/lib/data";
import type { Submission } from "@/lib/types";

const sub = (member: string, date: string, i = 0): Submission => ({ id: `${member}-${date}-${i}`, member, task: "t", date, status: "approved", time: "07:00" });
const day = (member: string, d: string, n: number) => Array.from({ length: n }, (_, i) => sub(member, d, i));

describe("ngày giờ", () => {
  it("cộng trừ ngày, qua tháng và qua năm", () => {
    expect(addDays("2026-10-04", 1)).toBe("2026-10-05");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("tuần bắt đầu thứ Hai", () => {
    expect(weekStartOf(0, "2026-10-04")).toBe("2026-09-28"); // Chủ nhật 04/10 thuộc tuần bắt đầu thứ Hai 28/09
    expect(weekStartOf(0, "2026-09-28")).toBe("2026-09-28"); // đúng thứ Hai
    expect(weekStartOf(0, "2026-09-30")).toBe("2026-09-28");
    expect(weekStartOf(-1, "2026-10-04")).toBe("2026-09-21");
  });
  it("định dạng đồng hồ đếm ngược", () => {
    expect(fmt(600000)).toBe("10:00");
    expect(fmt(61000)).toBe("01:01");
    expect(fmt(-5)).toBe("00:00");
    expect(toMin("19:45")).toBe(1185);
  });
});

describe("chuỗi ngày liền", () => {
  const today = "2026-10-04";
  it("đếm các ngày liền có ít nhất 3 việc được gật đầu", () => {
    const subs = [...day("bin", "2026-10-04", 3), ...day("bin", "2026-10-03", 4), ...day("bin", "2026-10-02", 3)];
    expect(streakOf(subs, "bin", today)).toBe(3);
  });
  it("hôm nay chưa đủ 3 thì chưa mất chuỗi", () => {
    const subs = [...day("bin", "2026-10-04", 1), ...day("bin", "2026-10-03", 3), ...day("bin", "2026-10-02", 3)];
    expect(streakOf(subs, "bin", today)).toBe(2);
  });
  it("đứt chuỗi khi một ngày không đủ 3 việc", () => {
    const subs = [...day("bin", "2026-10-04", 3), ...day("bin", "2026-10-03", 2), ...day("bin", "2026-10-02", 3)];
    expect(streakOf(subs, "bin", today)).toBe(1);
  });
  it("chỉ tính đúng bé đó và đúng việc đã gật đầu", () => {
    const pending = { ...sub("na", "2026-10-04", 9), status: "pending" as const };
    const subs = [...day("bin", "2026-10-04", 3), pending, ...day("na", "2026-10-03", 3)];
    expect(streakOf(subs, "bin", today)).toBe(1);
    expect(streakOf(subs, "na", today)).toBe(1); // hôm nay chưa đủ nhưng hôm qua đủ 3
    expect(streakOf(subs, "khong-co", today)).toBe(0);
  });
});

describe("heo Ủn lớn lên", () => {
  it("lên cấp theo chuỗi ngày", () => {
    expect(pigLevelOf(0).level).toBe(1);
    expect(pigLevelOf(2).level).toBe(1);
    expect(pigLevelOf(3).level).toBe(2);
    expect(pigLevelOf(7).level).toBe(3);
    expect(pigLevelOf(14).level).toBe(4);
    expect(pigLevelOf(100).level).toBe(4);
  });
  it("báo còn mấy ngày nữa lên cấp, cấp cao nhất thì không có cấp tiếp", () => {
    expect(pigLevelOf(5).next).toEqual({ name: "Ủn Mũ", daysLeft: 2 });
    expect(pigLevelOf(20).next).toBeNull();
  });
});
