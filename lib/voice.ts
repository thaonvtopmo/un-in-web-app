/**
 * Đọc lời khen thành tiếng bằng giọng tiếng Việt có sẵn trên máy (Web Speech API), không cần khoá hay chi phí.
 * Chất lượng giọng phụ thuộc thiết bị: iPhone, Android, Windows, Mac đều có giọng tiếng Việt.
 */
export const voiceSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Chờ danh sách giọng nạp xong (Chrome nạp chậm), tối đa ~1,2 giây */
async function voices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  let list = synth.getVoices();
  for (let i = 0; i < 6 && list.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 200));
    list = synth.getVoices();
  }
  return list;
}

export function pickVietnamese(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const vi = list.filter((v) => /^vi([-_]|$)/i.test(v.lang));
  const score = (v: SpeechSynthesisVoice) => (/natural|neural|online/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return vi.sort((a, b) => score(b) - score(a))[0];
}

/** Chia lời khen thành từng câu ngắn để máy đọc không bị cắt giữa chừng */
export function splitSentences(text: string): string[] {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?…\n]+[.!?…]*/g) ?? [];
  const out: string[] = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (p.length <= 160) { out.push(p); continue; }
    const words = p.split(" ");
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > 160) { out.push(cur.trim()); cur = w; } else cur += " " + w;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

export type SpeakResult = "ok" | "unsupported" | "no-vietnamese-voice" | "stopped";

let session = 0;

/* ---------- Phát file âm thanh (giọng đọc tạo ở máy chủ) ---------- */
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let player: HTMLAudioElement | null = null;
const blobCache = new Map<string, Blob>();

/**
 * iPhone chỉ cho phát âm thanh khi lệnh phát nằm ngay trong lúc bấm nút. Gọi hàm này đồng bộ trong thao tác bấm
 * để "mở khoá" thẻ audio, sau đó có thể tải file về rồi phát.
 */
export function unlockAudio() {
  if (typeof Audio === "undefined") return;
  player ??= new Audio();
  player.src = SILENT;
  void player.play().catch(() => undefined);
}

function playBlob(blob: Blob, mine: number): Promise<"ok" | "stopped" | "failed"> {
  return new Promise((resolve) => {
    player ??= new Audio();
    const a = player;
    const url = URL.createObjectURL(blob);
    const done = (r: "ok" | "stopped" | "failed") => {
      a.onended = a.onerror = a.onpause = null;
      URL.revokeObjectURL(url);
      resolve(r);
    };
    a.onended = () => done("ok");
    a.onerror = () => done("failed");
    a.src = url;
    a.play().then(() => { a.onpause = () => { if (!a.ended) done("stopped"); }; }).catch(() => done(mine === session ? "failed" : "stopped"));
  });
}

/** Tải sẵn âm thanh (để lúc bấm nghe là phát ngay) */
export async function prefetchAudio(key: string, load: () => Promise<Blob | null>): Promise<Blob | null> {
  const hit = blobCache.get(key);
  if (hit) return hit;
  const blob = await load().catch(() => null);
  if (blob) blobCache.set(key, blob);
  return blob;
}

/**
 * Đọc lời khen: ưu tiên file âm thanh từ máy chủ (chạy trên mọi điện thoại), không có thì dùng giọng đọc của máy.
 * Gọi unlockAudio() trong thao tác bấm trước khi gọi hàm này.
 */
export async function speakSmart(text: string, key: string, load: () => Promise<Blob | null>): Promise<SpeakResult> {
  const mine = ++session;
  if (voiceSupported()) window.speechSynthesis.cancel();
  const blob = await prefetchAudio(key, load);
  if (mine !== session) return "stopped";
  if (blob) {
    const r = await playBlob(blob, mine);
    if (r !== "failed") return r;
  }
  if (mine !== session) return "stopped";
  return speak(text);
}

/** Dừng đọc ngay */
export function stopSpeaking() {
  session++;
  if (player) { try { player.pause(); } catch { /* bỏ qua */ } }
  if (voiceSupported()) window.speechSynthesis.cancel();
}

/**
 * Đọc to một đoạn văn. Gọi từ thao tác bấm nút (iPhone chỉ cho phát âm thanh sau khi người dùng bấm).
 * Trả về khi đọc xong, bị dừng, hoặc máy chưa có giọng tiếng Việt.
 */
export async function speak(text: string): Promise<SpeakResult> {
  if (!voiceSupported()) return "unsupported";
  const synth = window.speechSynthesis;
  const mine = ++session;
  synth.cancel();
  const list = await voices();
  const voice = pickVietnamese(list);
  if (!voice && list.length > 0) return "no-vietnamese-voice";
  for (const sentence of splitSentences(text)) {
    if (mine !== session) return "stopped";
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = "vi-VN";
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = 1.05;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }
  return mine === session ? "ok" : "stopped";
}
