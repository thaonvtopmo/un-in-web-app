import { describe, expect, it } from "vitest";
import { alarmDue, doneKey, dueAlarm, fmtAt, nextAlarmFor, snoozeKey } from "@/lib/alarm";
import { ruleBuyPot, ruleSellPot, ruleStartGarden, sellPrice } from "@/lib/garden";
import type { Alarm } from "@/lib/types";
import { familyFixture } from "./fixture";

const bin = { id: "bin", role: "kid" as const };
const mk = (over: Partial<Alarm> = {}): Alarm => ({ id: "a1", title: "Dậy đi học", at: "06:50", repeat: 31, tone: "chuong", body: "", voice: "f", enabled: true, ...over });
const WED = "2026-10-07", SAT = "2026-10-10"; // Thứ Tư, Thứ Bảy
const memStore = (o: Record<string, string> = {}) => ({ getItem: (k: string) => o[k] ?? null });

describe("báo thức đến giờ", () => {
  it("kêu từ đúng giờ tới 15 phút sau, không kêu sớm", () => {
    expect(alarmDue(mk(), bin, WED, "06:49")).toBe(false);
    expect(alarmDue(mk(), bin, WED, "06:50")).toBe(true);
    expect(alarmDue(mk(), bin, WED, "07:04")).toBe(true);
    expect(alarmDue(mk(), bin, WED, "07:05")).toBe(false);
  });
  it("đúng thứ: T2–T6 không kêu thứ Bảy", () => {
    expect(alarmDue(mk(), bin, SAT, "06:51")).toBe(false);
    expect(alarmDue(mk({ repeat: 127 }), bin, SAT, "06:51")).toBe(true);
  });
  it("chỉ kêu cho bé được giao; bố mẹ và báo thức đã tắt thì không kêu", () => {
    expect(alarmDue(mk({ kids: ["na"] }), bin, WED, "06:51")).toBe(false);
    expect(alarmDue(mk({ kids: ["bin", "na"] }), bin, WED, "06:51")).toBe(true);
    expect(alarmDue(mk(), { id: "bo", role: "parent" }, WED, "06:51")).toBe(false);
    expect(alarmDue(mk({ enabled: false }), bin, WED, "06:51")).toBe(false);
  });
});

describe("tắt và hoãn", () => {
  it("bé đã bấm 'Con dậy rồi' hôm nay thì không kêu lại", () => {
    const store = memStore({ [doneKey("a1", WED)]: "1" });
    expect(dueAlarm([mk()], bin, WED, "06:55", Date.now(), store)).toBeNull();
    expect(dueAlarm([mk()], bin, WED, "06:55", Date.now(), memStore())?.id).toBe("a1");
  });
  it("hoãn 5 phút: chưa hết hoãn thì im, hết hoãn thì kêu lại", () => {
    const now = 1_000_000;
    expect(dueAlarm([mk()], bin, WED, "06:55", now, memStore({ [snoozeKey("a1")]: String(now + 60_000) }))).toBeNull();
    expect(dueAlarm([mk()], bin, WED, "06:55", now, memStore({ [snoozeKey("a1")]: String(now - 1) }))?.id).toBe("a1");
  });
  it("không đọc được bộ nhớ thì vẫn kêu", () => {
    const broken = { getItem: () => { throw new Error("blocked"); } };
    expect(dueAlarm([mk()], bin, WED, "06:55", Date.now(), broken)?.id).toBe("a1");
  });
});

describe("báo thức kế tiếp", () => {
  it("hôm nay còn thì lấy hôm nay, qua giờ thì lấy ngày mai", () => {
    expect(nextAlarmFor([mk()], bin, WED, "06:00")).toMatchObject({ offset: 0 });
    expect(nextAlarmFor([mk()], bin, WED, "08:00")).toMatchObject({ offset: 1 });
  });
  it("thứ Sáu qua giờ thì nhảy tới thứ Hai (T2–T6)", () => {
    expect(nextAlarmFor([mk()], bin, "2026-10-09", "08:00")).toMatchObject({ offset: 3 });
  });
  it("chọn báo thức sớm nhất, bỏ qua báo thức tắt hoặc của bé khác", () => {
    const list = [mk({ id: "x", at: "07:30" }), mk({ id: "y", at: "06:10", enabled: false }), mk({ id: "z", at: "06:00", kids: ["na"] })];
    expect(nextAlarmFor(list, bin, WED, "05:00")?.alarm.id).toBe("x");
    expect(nextAlarmFor([], bin, WED, "05:00")).toBeNull();
  });
  it("hiện giờ không thừa số 0 đầu", () => { expect(fmtAt("06:50")).toBe("6:50"); expect(fmtAt("18:05")).toBe("18:05"); });
});

describe("bán lại chậu", () => {
  const started = () => { const S = familyFixture(); S.coins.bin = 500; S.settings.gardenCap = 5000; ruleStartGarden(S, "bin"); return S; };
  it("nhận lại 60% giá (lỗ 40%)", () => {
    expect([20, 40, 60].map(sellPrice)).toEqual([12, 24, 36]);
  });
  it("mua rồi bán: ví chỉ lỗ 40%, chậu biến mất, cây dùng chậu đó về chậu đất, hạn mức tuần được hoàn", () => {
    const S = started();
    ruleBuyPot(S, "bin", "sao");
    S.gardens.bin.plants[0].pot = "sao";
    expect(S.coins.bin).toBe(460);
    expect(S.gardens.bin.spentWeek).toBe(40);
    expect(ruleSellPot(S, "bin", "sao")).toBe(24);
    expect(S.coins.bin).toBe(484);
    expect(S.gardens.bin.items).not.toContain("sao");
    expect(S.gardens.bin.plants[0].pot).toBe("dat");
    expect(S.gardens.bin.spentWeek).toBe(16);
  });
  it("không bán được chậu chưa mua, chậu miễn phí, chậu lạ; bán lần hai báo lỗi", () => {
    const S = started();
    expect(() => ruleSellPot(S, "bin", "xanh")).toThrow("not_owned");
    expect(() => ruleSellPot(S, "bin", "dat")).toThrow("invalid_item");
    expect(() => ruleSellPot(S, "bin", "abc")).toThrow("invalid_item");
    ruleBuyPot(S, "bin", "xanh");
    ruleSellPot(S, "bin", "xanh");
    expect(() => ruleSellPot(S, "bin", "xanh")).toThrow("not_owned");
  });
  it("khớp công thức ở database (60%)", () => {
    // sell_pot trong migration 022 tính (price * 60) / 100
    expect(sellPrice(100)).toBe(60);
  });
});

import { alarmMessage } from "@/lib/alarm-message";
describe("nội dung thông báo báo thức", () => {
  const base = { id: "a", family_id: "f", title: "Dậy đi học", at_text: "06:50", body: "", repeat_no: 0, kid_names: ["Beat"] };
  it("lần đầu có lời bố mẹ viết thì dùng đúng lời đó", () => {
    expect(alarmMessage({ ...base, body: "6 giờ 50 rồi, đi đánh răng nào!" })).toEqual({ title: "⏰ Dậy đi học (06:50)", body: "Beat ơi, 6 giờ 50 rồi, đi đánh răng nào!" });
  });
  it("không có lời viết (chỉ ghi âm hoặc chỉ chuông) thì dùng câu chung có tên bé", () => {
    expect(alarmMessage(base).body).toBe("Dậy thôi Beat ơi! Mở Ủn Ỉn để nghe lời nhắc.");
    expect(alarmMessage({ ...base, kid_names: ["Beat", "Ball"] }).body).toContain("Beat, Ball ơi");
    expect(alarmMessage({ ...base, kid_names: [] }).body).toContain("cả nhà");
  });
  it("lời quá dài bị cắt, khoảng trắng thừa được gọn", () => {
    expect(alarmMessage({ ...base, body: "a   b\n\nc" }).body).toBe("Beat ơi, a b c");
    expect(alarmMessage({ ...base, body: "x".repeat(500) }).body.length).toBeLessThan(170);
  });
  it("nhắc lại ghi rõ lần thứ mấy trên 3 và cách tắt", () => {
    const m = alarmMessage({ ...base, repeat_no: 2, body: "lời dài không dùng lại" });
    expect(m.title).toBe("⏰ Nhắc lại 2/3: Dậy đi học");
    expect(m.body).toContain("Con dậy rồi!");
    expect(m.body).not.toContain("lời dài");
  });
});
