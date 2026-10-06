/**
 * Ghi âm giọng bố mẹ bằng micro của máy (MediaRecorder). Chạy được trên iPhone (Safari 14.5+), Android và máy tính.
 * File ghi âm tối đa 60 giây, khoảng vài trăm KB.
 */
export const RECORD_MAX_SECS = 60;
export const RECORD_MIN_SECS = 1;
/** Bản ghi nhỏ hơn mức này coi như không thu được tiếng (một đoạn âm thanh thật dù ngắn cũng lớn hơn nhiều) */
export const MIN_BYTES = 200;

export type Take = { blob: Blob; mime: string; secs: number; /** thời gian ghi thật, mili giây */ ms: number };

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

/** Đánh giá bản ghi: ok, hoặc lý do không dùng được (để báo đúng cho bố mẹ) */
export function judgeTake(t: Take): "ok" | "short" | "silent" {
  if (t.blob.size < MIN_BYTES) return t.ms < RECORD_MIN_SECS * 1000 ? "short" : "silent";
  return "ok";
}

/** Gửi một dòng chẩn đoán về máy chủ (chỉ loại máy, định dạng, kích thước) để biết vì sao máy nào đó ghi âm không được */
function report(m: string) {
  try { navigator.sendBeacon("/api/client-error", JSON.stringify({ m, p: location.pathname, ua: navigator.userAgent })); } catch { /* bỏ qua */ }
}

export type Recording = { stop: () => Promise<Take>; cancel: () => void };

/**
 * Bắt đầu ghi âm. Ném lỗi "mic_denied" nếu chưa được phép dùng micro, "mic_unsupported" nếu máy không ghi âm được.
 * onTick báo số giây đã ghi; ghi tới 60 giây thì tự dừng và gọi onAutoStop với bản ghi.
 *
 * Không dùng chia nhỏ theo giây (timeslice) vì Safari trên iPhone có thể trả dữ liệu rỗng hoặc trả muộn:
 * ghi liền một mạch, khi dừng thì xin dữ liệu lần cuối và đợi tối đa 1,5 giây cho phần dữ liệu về đủ.
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
    rec = mime && !mime.includes("mp4") ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("mic_unsupported");
  }
  const chunks: Blob[] = [];
  const t0 = Date.now();
  let finished = false;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const release = () => { clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); };
  const build = (endAt: number): Take => {
    const type = rec.mimeType || mime || "audio/webm";
    const ms = endAt - t0; // tính tới lúc dừng, không tính thời gian đợi dữ liệu về
    const blob = new Blob(chunks, { type });
    if (blob.size < MIN_BYTES) report(`rec:small size=${blob.size} chunks=${chunks.length} type=${type} ms=${ms}`);
    return { blob, mime: type, secs: Math.min(RECORD_MAX_SECS, Math.max(RECORD_MIN_SECS, Math.round(ms / 1000))), ms };
  };
  // Sau sự kiện dừng, đợi dữ liệu cuối về (Safari có khi trả muộn) rồi mới đóng gói
  const stopped = new Promise<Take>((resolve) => {
    rec.onstop = () => {
      finished = true;
      release();
      const started = Date.now();
      const endAt = started;
      const settle = () => {
        if (chunks.length > 0 || Date.now() - started > 1500) resolve(build(endAt));
        else setTimeout(settle, 60);
      };
      setTimeout(settle, 60);
    };
  });
  const timer = setInterval(() => {
    const secs = Math.floor((Date.now() - t0) / 1000);
    onTick?.(Math.min(secs, RECORD_MAX_SECS));
    if (secs >= RECORD_MAX_SECS && rec.state === "recording") { try { rec.requestData(); } catch { /* bỏ qua */ } rec.stop(); void stopped.then((t) => onAutoStop?.(t)); }
  }, 250);
  rec.start();
  return {
    stop: () => {
      if (rec.state === "recording") { try { rec.requestData(); } catch { /* bỏ qua */ } rec.stop(); }
      return stopped;
    },
    cancel: () => { if (!finished) { rec.onstop = null; if (rec.state === "recording") rec.stop(); release(); } },
  };
}
