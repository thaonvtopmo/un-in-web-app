import { addDays, dowIdx } from "./data";
import type { Alarm, AlarmTone, Member } from "./types";

/** Báo thức: luật đến giờ, tiếng chuông tổng hợp (không cần file âm thanh) và tìm báo thức kế tiếp */
export const TONES: { id: AlarmTone; name: string }[] = [
  { id: "chuong", name: "Chuông leng keng" }, { id: "ga", name: "Gà gáy" }, { id: "nhac", name: "Nhạc vui" },
];
export const toneName = (id: AlarmTone) => TONES.find((t) => t.id === id)?.name ?? id;

/** Báo thức vẫn kêu nếu mở app muộn tới chừng này phút sau giờ hẹn */
export const WINDOW_MIN = 15;
export const SNOOZE_MIN = 5;
const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };

export const fmtAt = (hm: string) => `${Number(hm.slice(0, 2))}:${hm.slice(3, 5)}`;

/** Báo thức này có phải của bé này, hôm nay, và đang trong khung giờ kêu không */
export function alarmDue(a: Alarm, kid: Pick<Member, "id" | "role">, day: string, hm: string): boolean {
  if (!a.enabled || kid.role !== "kid") return false;
  if (a.kids && !a.kids.includes(kid.id)) return false;
  if (((a.repeat >> dowIdx(day)) & 1) !== 1) return false;
  const d = toMin(hm) - toMin(a.at);
  return d >= 0 && d < WINDOW_MIN;
}

export const doneKey = (id: string, day: string) => `un-alarm-done:${id}:${day}`;
export const snoozeKey = (id: string) => `un-alarm-snooze:${id}`;

type Store = Pick<Storage, "getItem">;
/** Báo thức đang đến giờ mà bé chưa tắt và không đang hoãn */
export function dueAlarm(alarms: Alarm[], kid: Pick<Member, "id" | "role">, day: string, hm: string, now: number, store: Store): Alarm | null {
  for (const a of alarms) {
    if (!alarmDue(a, kid, day, hm)) continue;
    let done = false, snoozedUntil = 0;
    try { done = store.getItem(doneKey(a.id, day)) === "1"; snoozedUntil = Number(store.getItem(snoozeKey(a.id)) ?? 0); } catch { /* không đọc được thì coi như chưa tắt */ }
    if (done || snoozedUntil > now) continue;
    return a;
  }
  return null;
}

/** Báo thức kế tiếp của một bé trong 7 ngày tới (để hiện trên trang chủ của bé) */
export function nextAlarmFor(alarms: Alarm[], kid: Pick<Member, "id" | "role">, day: string, hm: string): { alarm: Alarm; offset: number } | null {
  for (let offset = 0; offset <= 7; offset++) {
    const d = addDays(day, offset);
    const list = alarms
      .filter((a) => a.enabled && kid.role === "kid" && (!a.kids || a.kids.includes(kid.id)) && ((a.repeat >> dowIdx(d)) & 1) === 1 && (offset > 0 || toMin(a.at) >= toMin(hm)))
      .sort((x, y) => x.at.localeCompare(y.at));
    if (list[0]) return { alarm: list[0], offset };
  }
  return null;
}

/* ---------- Tiếng chuông tổng hợp bằng Web Audio ---------- */
let ctx: AudioContext | null = null;
type AC = typeof AudioContext;
export function audioCtx(): AudioContext | null {
  try {
    const W = window as unknown as { AudioContext?: AC; webkitAudioContext?: AC };
    const C = W.AudioContext ?? W.webkitAudioContext;
    if (!C) return null;
    ctx ??= new C();
    return ctx;
  } catch { return null; }
}

/** Mở khoá tiếng (iPhone, Chrome chỉ cho phát sau khi người dùng chạm). Trả về true nếu phát được. */
export async function unlockTone(): Promise<boolean> {
  const c = audioCtx();
  if (!c) return false;
  if (c.state === "suspended") { try { await c.resume(); } catch { /* chưa được phép */ } }
  return c.state === "running";
}

function tone(c: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, peak: number, slideTo?: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Một lượt tiếng chuông, dài khoảng 2,4 giây */
export function playPattern(c: AudioContext, id: AlarmTone, t0 = c.currentTime + 0.02) {
  if (id === "chuong") {
    for (let i = 0; i < 6; i++) for (const [f, p] of [[880, 0.22], [1318.5, 0.1], [1760, 0.07]] as const) tone(c, t0 + i * 0.3, f, 0.55, "sine", p);
  } else if (id === "ga") {
    for (let i = 0; i < 3; i++) { tone(c, t0 + i * 0.75, 380, 0.5, "sawtooth", 0.12, 760); tone(c, t0 + i * 0.75 + 0.5, 700, 0.22, "sawtooth", 0.1, 430); }
  } else {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, t0 + i * 0.24, f, 0.3, "triangle", 0.2));
  }
}

/** Phát tiếng chuông lặp lại tới khi gọi hàm trả về. */
export function startTone(id: AlarmTone): () => void {
  const c = audioCtx();
  if (!c) return () => {};
  const once = () => { if (c.state === "running") playPattern(c, id); };
  once();
  const timer = setInterval(once, 2500);
  return () => clearInterval(timer);
}
