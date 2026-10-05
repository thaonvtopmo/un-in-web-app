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

/** Dừng đọc ngay */
export function stopSpeaking() {
  session++;
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
