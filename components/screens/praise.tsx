"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { mem } from "@/lib/data";
import { RECORD_MAX_SECS, fmtSecs, judgeTake, recordingSupported, startRecording, type Recording, type Take } from "@/lib/recorder";
import { errorText, useApp } from "@/lib/store";
import { prefetchAudio, speakSmart, stopSpeaking, unlockAudio, type SpeakResult } from "@/lib/voice";
import type { Praise } from "@/lib/types";
import { Avatar, Empty } from "./common";
import { ChipSelect } from "./forms";

const MAX = 400;

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return day === today ? `Hôm nay ${hm}` : `${day.slice(8, 10)}/${day.slice(5, 7)} ${hm}`;
};

const VOICE_NOTE: Record<Exclude<SpeakResult, "ok" | "stopped">, string> = {
  unsupported: "Chưa tạo được giọng đọc lúc này (kiểm tra mạng nhé). Con vẫn đọc được chữ.",
  "no-vietnamese-voice": "Chưa tạo được giọng đọc lúc này và máy cũng chưa cài giọng tiếng Việt. Thử lại khi có mạng, hoặc tải gói tiếng Việt trong Cài đặt giọng nói của máy.",
};

const audioKey = (text: string, voice: "f" | "m") => `${voice}:${text}`;
const recKey = (path: string) => `rec:${path}`;

/**
 * Nút nghe: bấm để nghe, bấm lại để dừng.
 * Có file ghi âm thì phát đúng giọng bố mẹ; không thì dùng giọng AI tạo ở máy chủ, không có nữa thì giọng của máy.
 */
export function ListenButton({ text, voice = "f", praise, audio, label = "Nghe", className = "btn sm", onStart, onNote }: {
  text: string; voice?: "f" | "m"; praise?: string; audio?: Praise["audio"]; label?: string; className?: string; onStart?: () => void; onNote?: (note: string) => void;
}) {
  const { A } = useApp();
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  async function toggle() {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    unlockAudio(); // iPhone chỉ cho phát tiếng khi lệnh nằm ngay trong lúc bấm
    setPlaying(true);
    onStart?.();
    if (audio) {
      const r = await speakSmart("", recKey(audio.path), () => A.praiseAudio(audio.path), false);
      setPlaying(false);
      if (r === "unsupported") onNote?.("Chưa tải được lời ghi âm, kiểm tra mạng rồi thử lại nhé.");
      return;
    }
    const r = await speakSmart(text, audioKey(text, voice), () => A.tts({ praise, text: praise ? undefined : text, voice }));
    setPlaying(false);
    if (r === "unsupported" || r === "no-vietnamese-voice") onNote?.(VOICE_NOTE[r]);
  }
  return (
    <button type="button" className={className} onClick={toggle} aria-pressed={playing}>
      <Icon name={playing ? "pause" : "play"} size={16} strokeWidth={3} />{playing ? "Dừng" : label}
    </button>
  );
}

/* ---------- Ghi âm giọng của bố mẹ ---------- */
function VoiceRecorder({ take, onTake }: { take: Take | null; onTake: (t: Take | null) => void }) {
  const { A } = useApp();
  const [rec, setRec] = useState<Recording | null>(null);
  const [secs, setSecs] = useState(0);
  const recRef = useRef<Recording | null>(null);
  const url = useMemo(() => (take ? URL.createObjectURL(take.blob) : null), [take]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => recRef.current?.cancel(), []);

  async function start() {
    try {
      setSecs(0);
      onTake(null);
      const r = await startRecording(setSecs, (t) => { recRef.current = null; setRec(null); onTake(t); });
      recRef.current = r;
      setRec(r);
    } catch (e) {
      A.toast(errorText(e));
    }
  }
  async function stop() {
    if (!rec) return;
    const t = await rec.stop();
    recRef.current = null;
    setRec(null);
    const verdict = judgeTake(t);
    if (verdict === "short") { A.toast("Ghi âm hơi ngắn, nói thêm một chút nhé"); return; }
    if (verdict === "silent") { A.toast("Chưa thu được tiếng. Kiểm tra micro đang bật và đã cho phép trang này dùng micro, rồi thử lại nhé"); return; }
    onTake(t);
  }

  if (rec) {
    return (
      <div className="rec-take" role="group" aria-label="Đang ghi âm">
        <div className="row" style={{ gap: 10, justifyContent: "center" }}>
          <span className="rec-dot" aria-hidden="true" />
          <span className="rec-time" aria-live="off">{fmtSecs(secs)} / {fmtSecs(RECORD_MAX_SECS)}</span>
        </div>
        <button type="button" className="btn big coin" onClick={stop}><Icon name="check" size={20} strokeWidth={3.4} />Dừng và nghe lại</button>
      </div>
    );
  }
  if (take && url) {
    return (
      <div className="rec-take" role="group" aria-label="Bản ghi âm">
        <div className="row between"><b>Bản ghi âm {fmtSecs(take.secs)}</b><button type="button" className="btn sm" onClick={() => onTake(null)}>Ghi lại</button></div>
        <audio controls src={url} aria-label="Nghe lại bản ghi âm" />
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <button type="button" className="btn big rec-btn" onClick={start}><Icon name="mic" size={24} strokeWidth={2.6} />Bắt đầu ghi âm</button>
      <div className="muted">Nói tối đa {RECORD_MAX_SECS} giây, gần micro và chỗ yên tĩnh. Máy sẽ hỏi quyền dùng micro lần đầu.</div>
    </div>
  );
}

/* ---------- Bố mẹ: viết hoặc ghi âm rồi gửi lời khen ---------- */
export function PraiseTab() {
  const { S, A } = useApp();
  const kids = S.members.filter((m) => m.role === "kid");
  const [to, setTo] = useState(kids[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [voice, setVoice] = useState<"f" | "m">("f");
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [take, setTake] = useState<Take | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const target = S.members.find((m) => m.id === to) ?? kids[0];
  const canRecord = recordingSupported();
  const templates = target ? [
    `${target.name} ơi, hôm nay con tự giác làm việc không cần nhắc, bố mẹ rất tự hào về con.`,
    `${target.name} ơi, bố mẹ thấy con đã cố gắng rất nhiều. Cảm ơn con nhé!`,
    `${target.name} ơi, con biết giúp đỡ mọi người, con thật là một bạn nhỏ tuyệt vời.`,
  ] : [];
  const ready = mode === "voice" ? Boolean(take) : Boolean(body.trim());

  async function send() {
    if (!target) return;
    setBusy(true);
    const ok = await A.sendPraise(target.id, body, voice, mode === "voice" && take ? take : undefined);
    setBusy(false);
    if (ok) { setBody(""); setNote(""); setTake(null); }
  }

  return (
    <div className="parent-grid">
      <section className="card stack">
        <h3>Gửi lời khen cho con</h3>
        <div className="muted">Bố mẹ viết vài câu cho máy đọc, hoặc tự ghi âm giọng của mình. Con sẽ nghe khi vào chơi.</div>
        {kids.length === 0 ? <Empty title="Chưa có bé nào" hint="Thêm bé ở tab Thành viên để gửi lời khen." /> : (
          <>
            <div className="lbl">Gửi cho
              <ChipSelect label="Gửi cho" value={target?.id ?? ""} onChange={setTo} options={kids.map((k) => ({ value: k.id, label: k.name }))} />
            </div>
            <div className="lbl">Cách gửi
              <ChipSelect label="Cách gửi" value={mode} onChange={(m) => { setMode(m); setNote(""); }}
                options={[{ value: "text", label: "Viết chữ, giọng AI đọc" }, { value: "voice", label: "Ghi âm giọng của mình" }]} />
            </div>

            {mode === "voice" ? (
              canRecord ? (
                <>
                  <VoiceRecorder take={take} onTake={setTake} />
                  <label className="lbl">Thêm vài chữ cho con xem (không bắt buộc)
                    <input className="field" name="caption" maxLength={MAX} value={body} placeholder="Ví dụ: Bố tự hào về con!" onChange={(e) => setBody(e.target.value)} />
                  </label>
                </>
              ) : (
                <div className="ad-note" role="status" style={{ background: "var(--purple-soft)", border: "2px dashed var(--ink)", borderRadius: 12, padding: "8px 12px" }}>
                  Trình duyệt này chưa ghi âm được. Thử mở bằng Safari hoặc Chrome bản mới, hoặc dùng cách viết chữ.
                </div>
              )
            ) : (
              <>
                <label className="lbl">Lời khen
                  <textarea className="field" name="praise" rows={4} maxLength={MAX} value={body} placeholder={`Ví dụ: ${target?.name ?? "Con"} ơi, hôm nay con tự dậy sớm, bố mẹ rất tự hào!`}
                    onChange={(e) => setBody(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} />
                  <span className="muted" style={{ textAlign: "right", fontSize: 12 }}>{body.length}/{MAX}</span>
                </label>
                <div className="stack" style={{ gap: 6 }}>
                  <span className="muted">Gợi ý nhanh (bấm để điền)</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {templates.map((t, i) => (
                      <button key={i} type="button" className="pill" style={{ minHeight: 36, textAlign: "left", background: "var(--sand)" }} onClick={() => setBody(t)}>{t.length > 46 ? t.slice(0, 44) + "…" : t}</button>
                    ))}
                  </div>
                </div>
                <div className="lbl">Giọng đọc
                  <ChipSelect label="Giọng đọc" value={voice} onChange={setVoice} options={[{ value: "f", label: "Giọng nữ" }, { value: "m", label: "Giọng nam" }]} />
                </div>
              </>
            )}

            {note && <div role="status" className="muted" style={{ color: "#9D174D" }}>{note}</div>}
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {mode === "text" && body.trim() && <ListenButton text={body} voice={voice} label="Nghe thử" onNote={setNote} />}
              <button className="btn mint grow" type="button" disabled={busy || !ready} onClick={send}>
                <Icon name="heart" size={18} strokeWidth={3} />{busy ? "Đang gửi..." : `Gửi lời khen${target ? ` cho ${target.name}` : ""}`}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <h3>Lời khen đã gửi</h3>
        {S.praises.length === 0 && <Empty title="Chưa có lời khen nào" hint="Lời khen đã gửi sẽ hiện ở đây, kèm việc con đã nghe hay chưa." />}
        {S.praises.map((p) => (
          <div key={p.id} className="card stack flat" style={{ gap: 6, padding: "10px 12px" }}>
            <div className="row" style={{ gap: 8 }}>
              <Avatar m={mem(S, p.to)} size={30} fs={12} />
              <div className="grow">
                <b style={{ fontSize: 14 }}>{mem(S, p.from).name} khen {mem(S, p.to).name}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {when(p.at)} · {p.heard ? "con đã nghe" : "con chưa nghe"}{p.audio ? ` · ghi âm ${fmtSecs(p.audio.secs)}` : ""}
                </div>
              </div>
              <ListenButton text={p.body} voice={p.voice} praise={p.id} audio={p.audio} label="Nghe" />
              <button className="btn sm" aria-label="Xoá lời khen" onClick={() => { if (window.confirm("Xoá lời khen này?")) void A.deletePraise(p.id); }}><Icon name="trash" size={16} /></button>
            </div>
            {p.body && <div style={{ fontSize: 14, fontWeight: 600 }}>{p.body}</div>}
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------- Con: nghe lời khen ---------- */
export function KidPraise() {
  const { S, U, A } = useApp();
  const k = U.member!;
  const mine = S.praises.filter((p) => p.to === k);
  const [note, setNote] = useState("");
  const [showing, setShowing] = useState<string | null>(null);
  const leadItem = mine.filter((p) => !p.heard).pop() ?? mine[0];
  const leadId = leadItem?.id;
  const leadVoice = leadItem?.voice ?? "f";
  const leadBody = leadItem?.body;
  const leadAudio = leadItem?.audio;
  // tải sẵn âm thanh để bấm "Nghe nè" là phát ngay
  useEffect(() => {
    if (!leadId) return;
    if (leadAudio) void prefetchAudio(recKey(leadAudio.path), () => A.praiseAudio(leadAudio.path));
    else if (leadBody) void prefetchAudio(audioKey(leadBody, leadVoice), () => A.tts({ praise: leadId, voice: leadVoice }));
  }, [A, leadId, leadBody, leadVoice, leadAudio]);
  if (!mine.length) return null;
  const unread = mine.filter((p) => !p.heard);
  const lead: Praise = unread[unread.length - 1] ?? mine[0]; // chưa nghe thì lấy lời khen cũ nhất chưa nghe, không thì lời khen mới nhất
  const isNew = !lead.heard;
  const from = mem(S, lead.from).name;

  return (
    <section className={`card stack praise-card ${isNew ? "new" : ""}`} aria-label="Lời khen từ bố mẹ" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="praise-icon" aria-hidden="true">{lead.audio ? "🎙️" : "💌"}</span>
        <div className="grow">
          <b style={{ fontSize: 15 }}>{isNew ? `${from} gửi lời khen cho con!` : `Lời khen của ${from}`}</b>
          {lead.audio && <div className="muted" style={{ fontSize: 12 }}>Giọng nói của {from}, {fmtSecs(lead.audio.secs)}</div>}
          {unread.length > 1 && <div className="muted" style={{ fontSize: 12 }}>Còn {unread.length - 1} lời khen nữa chưa nghe</div>}
        </div>
      </div>
      {lead.body && (isNew ? showing === lead.id : true) && <div className="praise-text">{lead.body}</div>}
      {note && <div role="status" className="muted">{note}</div>}
      <div className="row" style={{ gap: 8 }}>
        <ListenButton text={lead.body} voice={lead.voice} praise={lead.id} audio={lead.audio} label={isNew ? "Nghe nè" : "Nghe lại"} className="btn mint grow" onNote={setNote}
          onStart={() => { setShowing(lead.id); if (isNew) void A.markPraiseHeard(lead.id); }} />
        {isNew && lead.body && showing !== lead.id && <button className="btn" onClick={() => { setShowing(lead.id); void A.markPraiseHeard(lead.id); }}>Đọc chữ</button>}
      </div>
    </section>
  );
}
