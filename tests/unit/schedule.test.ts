import { describe, expect, it } from "vitest";
import { DOW_SHORT, REPEAT_ALL, REPEAT_WEEKDAYS, REPEAT_WEEKEND, dowIdx, kidTasks, parentTasks, repeatLabel, taskOnDay } from "@/lib/data";
import { rulePlan } from "@/lib/rules";
import { familyFixture } from "./fixture";

// 2026-10-05 là Thứ Hai, 2026-10-10 là Thứ Bảy, 2026-10-11 là Chủ nhật
describe("lịch lặp theo thứ", () => {
  it("thứ trong tuần: Thứ Hai = 0, Chủ nhật = 6", () => {
    expect(dowIdx("2026-10-05")).toBe(0);
    expect(dowIdx("2026-10-09")).toBe(4);
    expect(dowIdx("2026-10-10")).toBe(5);
    expect(dowIdx("2026-10-11")).toBe(6);
    expect(DOW_SHORT[dowIdx("2026-10-11")]).toBe("CN");
  });
  it("việc mỗi ngày thì ngày nào cũng giao", () => {
    const S = familyFixture();
    for (const d of ["2026-10-05", "2026-10-08", "2026-10-11"]) expect(taskOnDay(S, S.tasks[0], d)).toBe(true);
  });
  it("T2–T6 giao ngày đi học, không giao cuối tuần", () => {
    const S = familyFixture();
    S.tasks[0].repeat = REPEAT_WEEKDAYS;
    expect(taskOnDay(S, S.tasks[0], "2026-10-05")).toBe(true);
    expect(taskOnDay(S, S.tasks[0], "2026-10-09")).toBe(true);
    expect(taskOnDay(S, S.tasks[0], "2026-10-10")).toBe(false);
    expect(taskOnDay(S, S.tasks[0], "2026-10-11")).toBe(false);
  });
  it("cuối tuần chỉ giao T7 và CN; không lặp thì không ngày nào", () => {
    const S = familyFixture();
    S.tasks[0].repeat = REPEAT_WEEKEND;
    expect(taskOnDay(S, S.tasks[0], "2026-10-10")).toBe(true);
    expect(taskOnDay(S, S.tasks[0], "2026-10-05")).toBe(false);
    S.tasks[0].repeat = 0;
    expect(taskOnDay(S, S.tasks[0], "2026-10-10")).toBe(false);
  });
  it("tên lịch lặp dễ đọc", () => {
    expect(repeatLabel(REPEAT_ALL)).toBe("Mỗi ngày");
    expect(repeatLabel(REPEAT_WEEKDAYS)).toBe("T2–T6");
    expect(repeatLabel(REPEAT_WEEKEND)).toBe("Cuối tuần");
    expect(repeatLabel(0)).toBe("Chỉ ngày được chọn");
    expect(repeatLabel(0b0010101)).toBe("T2, T4, T6");
  });
});

describe("kế hoạch từng ngày ghi đè lịch lặp", () => {
  it("bật một việc không lặp cho đúng một ngày", () => {
    const S = familyFixture();
    S.tasks[0].repeat = 0;
    rulePlan(S, "2026-10-07", [{ task: "t1", enabled: true }]);
    expect(taskOnDay(S, S.tasks[0], "2026-10-07")).toBe(true);
    expect(taskOnDay(S, S.tasks[0], "2026-10-08")).toBe(false);
  });
  it("tắt một việc mỗi ngày cho đúng một hôm", () => {
    const S = familyFixture();
    rulePlan(S, "2026-10-07", [{ task: "t1", enabled: false }]);
    expect(taskOnDay(S, S.tasks[0], "2026-10-07")).toBe(false);
    expect(taskOnDay(S, S.tasks[0], "2026-10-06")).toBe(true);
  });
  it("null là bỏ ghi đè, quay về lịch lặp", () => {
    const S = familyFixture();
    rulePlan(S, "2026-10-07", [{ task: "t1", enabled: false }]);
    rulePlan(S, "2026-10-07", [{ task: "t1", enabled: null }]);
    expect(taskOnDay(S, S.tasks[0], "2026-10-07")).toBe(true);
  });
  it("con và bố mẹ chỉ thấy việc đã giao cho ngày đó", () => {
    const S = familyFixture();
    const day = "2026-10-07";
    rulePlan(S, day, [{ task: "t1", enabled: false }, { task: "p1", enabled: false }]);
    expect(kidTasks(S, day).map((t) => t.id)).toEqual(["g1", "g2"]);
    expect(parentTasks(S, day)).toEqual([]);
    expect(kidTasks(S, "2026-10-08").map((t) => t.id)).toEqual(["t1", "g1", "g2"]);
  });
});
