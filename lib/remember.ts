/**
 * Ghi nhớ trên máy này: ai đang chơi (bé hoặc bố/mẹ), để mở lại app không phải chọn người và nhập PIN lại.
 * Chỉ lưu trên máy (không lên máy chủ). Bé được nhớ cho tới khi bấm Thoát; bố/mẹ được nhớ trong thời gian
 * không dùng do bố mẹ chọn ở Cài đặt (mặc định 2 giờ), bấm Thoát là quên ngay.
 */
const KEY = "un-profile-v1";
const OPT = "un-remember-parent-v1";

export type Remembered = { member: string; role: "kid" | "parent"; at: number };

/** Các mức nhớ bố/mẹ (mili giây); 0 = luôn hỏi PIN lại */
export const PARENT_REMEMBER: { ms: number; label: string }[] = [
  { ms: 0, label: "Không nhớ" }, { ms: 30 * 60_000, label: "30 phút" }, { ms: 2 * 3600_000, label: "2 giờ" }, { ms: 24 * 3600_000, label: "1 ngày" },
];
export const DEFAULT_PARENT_REMEMBER = 2 * 3600_000;

export function parentRememberMs(): number {
  try {
    const v = localStorage.getItem(OPT);
    if (v === null) return DEFAULT_PARENT_REMEMBER;
    const n = Number(v);
    return PARENT_REMEMBER.some((o) => o.ms === n) ? n : DEFAULT_PARENT_REMEMBER;
  } catch { return DEFAULT_PARENT_REMEMBER; }
}
export function setParentRememberMs(ms: number) {
  try { localStorage.setItem(OPT, String(ms)); } catch { /* bỏ qua */ }
}

export function remember(member: string, role: "kid" | "parent") {
  try { localStorage.setItem(KEY, JSON.stringify({ member, role, at: Date.now() } satisfies Remembered)); } catch { /* bỏ qua */ }
}
export function forget() {
  try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ }
}
/** Gia hạn thời gian nhớ khi bố/mẹ còn đang dùng */
export function touchParent() {
  try {
    const r = read();
    if (r && r.role === "parent") localStorage.setItem(KEY, JSON.stringify({ ...r, at: Date.now() }));
  } catch { /* bỏ qua */ }
}
function read(): Remembered | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Remembered;
    return r && typeof r.member === "string" && (r.role === "kid" || r.role === "parent") && typeof r.at === "number" ? r : null;
  } catch { return null; }
}

/** Người cần mở lại: bé thì luôn; bố/mẹ nếu chưa quá thời gian đã chọn */
export function recall(now = Date.now()): Remembered | null {
  const r = read();
  if (!r) return null;
  if (r.role === "kid") return r;
  const ms = parentRememberMs();
  return ms > 0 && now - r.at <= ms ? r : null;
}
