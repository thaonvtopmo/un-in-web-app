/**
 * Ghi âm giọng bố mẹ bằng micro của máy (MediaRecorder). Chạy được trên iPhone (Safari 14.5+), Android và máy tính.
 * File ghi âm tối đa 60 giây, khoảng vài trăm KB.
 */
export const RECORD_MAX_SECS = 60;
export const RECORD_MIN_SECS = 1;

export type Take = { blob: Blob; mime: string; secs: number };

/** Chọn định dạng ghi âm trình duyệt hỗ trợ (iPhone dùng mp4, Chrome/Android dùng webm) */
export function pickRecorderMime(isSupported: (m: string) => boolean): string | null {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (isSupported(m)) return m;
  return null;
}

/** Đuôi file theo loại âm thanh */
export const extOf = (mime: string) => (mime.includes("mp4") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : "webm");
/** Loại file gửi lên kho (bỏ phần "; codecs=...") */
export const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase() || "audio/webm";

export const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, "0")}`;

export const recordingSupported = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

export type Recording = { stop: () => Promise<Take>; cancel: () => void };

/**
 * Bắt đầu ghi âm. Ném lỗi "mic_denied" nếu chưa được phép dùng micro, "mic_unsupported" nếu máy không ghi âm được.
 * onTick báo số giây đã ghi; ghi tới 60 giây thì tự dừng và gọi onAutoStop với bản ghi.
 */
export async function startRecording(onTick?: (secs: number) => void, onAutoStop?: (take: Take) => void): Promise<Recording> {
  if (!recordingSupported()) throw new Error("mic_unsupported");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    throw new Error("mic_denied");
  }
  const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported?.(m) ?? false);
  let rec: MediaRecorder;
  try {
    rec = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("mic_unsupported");
  }
  const chunks: Blob[] = [];
  const t0 = Date.now();
  let finished = false;
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const release = () => { clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); };
  const build = (): Take => {
    const type = rec.mimeType || mime || "audio/webm";
    return { blob: new Blob(chunks, { type }), mime: type, secs: Math.min(RECORD_MAX_SECS, Math.max(RECORD_MIN_SECS, Math.round((Date.now() - t0) / 1000))) };
  };
  const stopped = new Promise<Take>((resolve) => { rec.onstop = () => { finished = true; release(); resolve(build()); }; });
  const timer = setInterval(() => {
    const secs = Math.floor((Date.now() - t0) / 1000);
    onTick?.(Math.min(secs, RECORD_MAX_SECS));
    if (secs >= RECORD_MAX_SECS && rec.state === "recording") { rec.stop(); void stopped.then((t) => onAutoStop?.(t)); }
  }, 250);
  rec.start(1000);
  return {
    stop: () => { if (rec.state === "recording") rec.stop(); return stopped; },
    cancel: () => { if (!finished) { rec.onstop = null; if (rec.state === "recording") rec.stop(); release(); } },
  };
}
