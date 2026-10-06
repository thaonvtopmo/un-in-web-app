import { describe, expect, it } from "vitest";
import { baseMime, extOf, fmtSecs, pickRecorderMime } from "@/lib/recorder";

describe("ghi âm", () => {
  it("Chrome/Android: ưu tiên webm opus", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
  });
  it("iPhone chỉ có mp4 thì dùng mp4", () => {
    expect(pickRecorderMime((m) => m === "audio/mp4")).toBe("audio/mp4");
  });
  it("không định dạng nào hỗ trợ thì trả null (để trình duyệt tự chọn)", () => {
    expect(pickRecorderMime(() => false)).toBeNull();
  });
  it("đuôi file theo loại âm thanh", () => {
    expect(extOf("audio/webm;codecs=opus")).toBe("webm");
    expect(extOf("audio/mp4")).toBe("m4a");
    expect(extOf("audio/aac")).toBe("m4a");
    expect(extOf("audio/ogg;codecs=opus")).toBe("ogg");
    expect(extOf("audio/mpeg")).toBe("mp3");
  });
  it("loại file gửi lên kho bỏ phần codecs", () => {
    expect(baseMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseMime("AUDIO/MP4")).toBe("audio/mp4");
    expect(baseMime("")).toBe("audio/webm");
  });
  it("hiện thời gian phút:giây", () => {
    expect([0, 7, 59, 60, 61, 125].map(fmtSecs)).toEqual(["0:00", "0:07", "0:59", "1:00", "1:01", "2:05"]);
  });
});
