import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { judgeTake, startRecording, type Take } from "@/lib/recorder";

/** MediaRecorder giả để thử các kiểu Safari trả dữ liệu: đủ, trễ sau sự kiện dừng, hoặc rỗng */
type Mode = "normal" | "late" | "empty";
let mode: Mode = "normal";
const bytes = (n: number) => new Blob([new Uint8Array(n)], { type: "audio/mp4" });

class FakeRecorder {
  static isTypeSupported = (m: string) => m === "audio/mp4";
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/mp4";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown, public opts?: unknown) {}
  start() { this.state = "recording"; }
  requestData() { if (mode === "normal" && this.state === "recording") this.ondataavailable?.({ data: bytes(40_000) }); }
  stop() {
    this.state = "inactive";
    if (mode === "late") { setTimeout(() => this.onstop?.(), 0); setTimeout(() => this.ondataavailable?.({ data: bytes(40_000) }), 400); }
    else setTimeout(() => this.onstop?.(), 0);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  const track = { stop: vi.fn() };
  const nav = { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) }, sendBeacon: vi.fn(), userAgent: "test" };
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, "location", { value: { pathname: "/" }, configurable: true });
  Object.defineProperty(globalThis, "MediaRecorder", { value: FakeRecorder, configurable: true });
});
afterEach(() => { vi.useRealTimers(); });

async function record(ms: number): Promise<Take> {
  const r = await startRecording();
  await vi.advanceTimersByTimeAsync(ms);
  const p = r.stop();
  await vi.advanceTimersByTimeAsync(2000);
  return p;
}

describe("ghi âm trên các kiểu trình duyệt", () => {
  it("dữ liệu về đủ: ghi 7 giây dùng được", async () => {
    mode = "normal";
    const t = await record(7000);
    expect(t.secs).toBe(7);
    expect(t.blob.size).toBe(40_000);
    expect(judgeTake(t)).toBe("ok");
  });
  it("Safari trả dữ liệu trễ sau sự kiện dừng: vẫn đợi và lấy được (lỗi \"quá ngắn\" trước đây)", async () => {
    mode = "late";
    const t = await record(7000);
    expect(t.blob.size).toBe(40_000);
    expect(judgeTake(t)).toBe("ok");
  });
  it("không thu được tiếng thì báo riêng, không nói là quá ngắn", async () => {
    mode = "empty";
    const t = await record(7000);
    expect(t.blob.size).toBe(0);
    expect(judgeTake(t)).toBe("silent");
  });
  it("bấm dừng gần như ngay thì mới báo quá ngắn", async () => {
    mode = "empty";
    const t = await record(300);
    expect(judgeTake(t)).toBe("short");
  });
  it("chưa được phép dùng micro thì báo mic_denied", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("NotAllowedError"));
    await expect(startRecording()).rejects.toThrow("mic_denied");
  });
});
