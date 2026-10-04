import { describe, expect, it } from "vitest";
import { errorText } from "@/lib/store";

describe("câu báo lỗi dễ hiểu", () => {
  it("đổi mã lỗi của server thành tiếng Việt", () => {
    expect(errorText(new Error("outside_window"))).toMatch(/chưa tới giờ chơi/);
    expect(errorText(new Error("time_up"))).toMatch(/Hết giờ chơi/);
    expect(errorText(new Error("insufficient"))).toMatch(/Chưa đủ Ủn/);
    expect(errorText(new Error("pin_locked"))).toMatch(/5 phút/);
    expect(errorText(new Error("not_assigned"))).toMatch(/không phải của/);
    expect(errorText(new Error("balance_negative"))).toMatch(/đã tiêu/);
  });
  it("lỗi lạ thì báo chung chung, không lộ chi tiết kỹ thuật", () => {
    const t = errorText(new Error("PGRST301: JWT expired at xyz"));
    expect(t).not.toMatch(/PGRST|JWT/);
    expect(errorText("không phải Error")).toMatch(/thử lại/);
  });
});
