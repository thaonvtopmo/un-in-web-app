"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Pig } from "@/components/Pig";
import { SNOOZE_MIN, TONES, dueAlarm, doneKey, fmtAt, nextAlarmFor, snoozeKey, startTone, toneName, unlockTone } from "@/lib/alarm";
import { DOW_SHORT, dowIdx, hhmm, repeatLabel, today } from "@/lib/data";
import { fmtSecs, type Take } from "@/lib/recorder";
import { useApp } from "@/lib/store";
import type { Alarm, AlarmTone, Member } from "@/lib/types";
import { speakSmart, stopSpeaking, unlockAudio } from "@/lib/voice";
import { Empty } from "./common";
import { ChipSelect, RepeatPicker } from "./forms";
import { ListenButton, VoiceRecorder } from "./praise";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const recKey = (path: string) => `rec:${path}`;

/* ---------- Màn chuông reo: tiếng chuông rồi tới lời nhắc của bố mẹ, lặp lại tới khi bé bấm ---------- */
export function AlarmRinger({ alarm, who, preview = false, onDone, onSnooze }: {
  alarm: Alarm; who: string; preview?: boolean; onDone: () => void; onSnooze?: () => void;
}) {
  const { A } = useApp();
  const [blocked, setBlocked] = useState(false);
  const [round, setRound] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let stopTone: (() => void) | null = null;
    (async () => {
      const ok = await unlockTone();
      if (alive.current) setBlocked(!ok);
      while (alive.current) {
        stopTone = startTone(alarm.tone);
        await sleep(6500);
        stopTone?.(); stopTone = null;
        if (!alive.current) break;
        if (alarm.audio) { const p = alarm.audio.path; await speakSmart("", recKey(p), () => A.praiseAudio(p), false); }
        else if (alarm.body) { const t = alarm.body; await speakSmart(t, `${alarm.voice}:${t}`, () => A.tts({ text: t, voice: alarm.voice })); }
        if (!alive.current) break;
        await sleep(7000);
      }
    })();
    try { navigator.vibrate?.([400, 200, 400, 200, 800]); } catch { /* máy không rung được */ }
    return () => { alive.current = false; stopTone?.(); stopSpeaking(); };
  }, [alarm, A, round]);

  function tap() {
    // Trình duyệt chỉ cho phát tiếng sau khi chạm: chạm một cái là mở khoá rồi chuông chạy lại từ đầu
    if (!blocked) return;
    unlockAudio();
    setBlocked(false);
    setRound((r) => r + 1);
  }

  return (
    <div className="overlay alarm-ring" role="alertdialog" aria-modal="true" aria-label={`Báo thức ${fmtAt(alarm.at)}`} onPointerDown={tap}
      style={{ background: "var(--coin)", flexDirection: "column", gap: 12, textAlign: "center" }}>
      <div className="bob"><Pig mood="joy" size={140} /></div>
      <div className="display" style={{ fontSize: 64, lineHeight: 1 }}>{fmtAt(alarm.at)}</div>
      <div className="display" style={{ fontSize: 26 }}>{alarm.title}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{preview ? "Đây là bản thử, các con không nghe thấy." : `Dậy thôi ${who} ơi!`}</div>
      {alarm.body && <div className="praise-text" style={{ maxWidth: 340 }}>{alarm.body}</div>}
      {blocked && <div role="status" className="pill" style={{ background: "#fff", fontSize: 14 }}>🔔 Chạm vào màn hình để nghe chuông</div>}
      <button className="btn big mint" style={{ maxWidth: 340 }} onClick={onDone}>{preview ? "Dừng thử" : "Con dậy rồi!"}</button>
      {!preview && onSnooze && <button className="btn" style={{ maxWidth: 340 }} onClick={onSnooze}>Ngủ thêm {SNOOZE_MIN} phút</button>}
    </div>
  );
}

/* ---------- Máy của bé: canh giờ, chuông reo đúng giờ, giữ màn hình sáng nếu bé muốn ---------- */
const AWAKE_KEY = "un-keep-awake";
const awake = () => { try { return localStorage.getItem(AWAKE_KEY) === "1"; } catch { return false; } };

export function AlarmWatcher() {
  const { S, U } = useApp();
  const me = S.members.find((m) => m.id === U.member);
  const [ring, setRing] = useState<Alarm | null>(null);
  const ringRef = useRef<Alarm | null>(null);
  useEffect(() => { ringRef.current = ring; }, [ring]);
  const alarms = S.alarms;
  const [keep, setKeep] = useState(awake);

  // Mỗi 2 giây xem có báo thức nào đến giờ chưa
  useEffect(() => {
    if (!me || me.role !== "kid") return;
    const t = setInterval(() => {
      if (ringRef.current) return;
      const a = dueAlarm(alarms, me, today(), hhmm(), Date.now(), localStorage);
      if (a) setRing(a);
    }, 2000);
    return () => clearInterval(t);
  }, [alarms, me]);

  // Quay lại app đúng lúc báo thức: kiểm tra ngay, khỏi đợi
  useEffect(() => {
    if (!me || me.role !== "kid") return;
    const on = () => {
      if (document.visibilityState !== "visible" || ringRef.current) return;
      const a = dueAlarm(alarms, me, today(), hhmm(), Date.now(), localStorage);
      if (a) setRing(a);
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [alarms, me]);

  // Chạm lần đầu vào app là mở khoá tiếng, để chuông sau này kêu được ngay
  useEffect(() => {
    const unlock = () => { void unlockTone(); unlockAudio(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Giữ màn hình sáng (Wake Lock) khi bé bật, để tablet đầu giường vẫn mở sẵn chờ báo thức
  useEffect(() => {
    const onChange = () => setKeep(awake());
    window.addEventListener("un-keep-awake", onChange);
    return () => window.removeEventListener("un-keep-awake", onChange);
  }, []);
  const hasAlarm = Boolean(me && alarms.some((a) => a.enabled && (!a.kids || a.kids.includes(me.id))));
  useEffect(() => {
    if (!keep || !hasAlarm) return;
    type Lock = { release: () => Promise<void> };
    const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<Lock> } };
    if (!nav.wakeLock) return;
    let lock: Lock | null = null;
    let alive = true;
    const get = async () => { try { const l = await nav.wakeLock!.request("screen"); if (alive) lock = l; else void l.release(); } catch { /* máy không cho */ } };
    void get();
    const onVis = () => { if (document.visibilityState === "visible") void get(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); void lock?.release(); };
  }, [keep, hasAlarm]);

  if (!ring || !me) return null;
  const finish = () => { try { localStorage.setItem(doneKey(ring.id, today()), "1"); } catch { /* bỏ qua */ } setRing(null); };
  const snooze = () => { try { localStorage.setItem(snoozeKey(ring.id), String(Date.now() + SNOOZE_MIN * 60_000)); } catch { /* bỏ qua */ } setRing(null); };
  return <AlarmRinger alarm={ring} who={me.name} onDone={finish} onSnooze={snooze} />;
}

/** Trang chủ của bé: báo thức kế tiếp và nút giữ màn hình sáng */
export function AlarmCard({ kid }: { kid: Member }) {
  const { S } = useApp();
  const [keep, setKeep] = useState(awake);
  const next = nextAlarmFor(S.alarms, kid, today(), hhmm());
  if (!next) return null;
  const { alarm, offset } = next;
  const when = offset === 0 ? "hôm nay" : offset === 1 ? "ngày mai" : DOW_SHORT[dowIdx(addDaysStr(offset))];
  return (
    <section className="card stack" aria-label="Báo thức" style={{ background: "var(--coin-soft)", gap: 6 }}>
      <div className="row" style={{ gap: 10 }}>
        <span aria-hidden="true" style={{ fontSize: 26 }}>⏰</span>
        <div className="grow">
          <b style={{ fontSize: 15 }}>Báo thức {fmtAt(alarm.at)} · {alarm.title}</b>
          <div className="muted" style={{ fontSize: 12 }}>Kêu {when}. Để chuông kêu đúng giờ, mở sẵn Ủn Ỉn trên máy này.</div>
        </div>
      </div>
      <label className="lbl check">
        <input type="checkbox" checked={keep} onChange={(e) => { setKeep(e.target.checked); try { localStorage.setItem(AWAKE_KEY, e.target.checked ? "1" : "0"); } catch { /* bỏ qua */ } window.dispatchEvent(new Event("un-keep-awake")); }} />
        Giữ màn hình sáng để chuông kêu đúng giờ
      </label>
    </section>
  );
}
const addDaysStr = (n: number) => { const d = new Date(today() + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- Bố mẹ: tạo và quản lý báo thức ---------- */
type Mode = "rec" | "text" | "none";

function AlarmForm({ initial, onDone }: { initial?: Alarm; onDone: () => void }) {
  const { S, A } = useApp();
  const kids = S.members.filter((m) => m.role === "kid");
  const [title, setTitle] = useState(initial?.title ?? "Dậy đi học");
  const [at, setAt] = useState(initial?.at ?? "06:50");
  const [repeat, setRepeat] = useState(initial?.repeat ?? 31);
  const [sel, setSel] = useState<string[]>(initial?.kids ?? kids.map((k) => k.id));
  const [tone, setTone] = useState<AlarmTone>(initial?.tone ?? "chuong");
  const [mode, setMode] = useState<Mode>(initial ? (initial.audio ? "rec" : initial.body ? "text" : "none") : "rec");
  const [body, setBody] = useState(initial?.body ?? "");
  const [voice, setVoice] = useState<"f" | "m">(initial?.voice ?? "f");
  const [take, setTake] = useState<Take | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const stopPreview = useRef<(() => void) | null>(null);
  useEffect(() => () => stopPreview.current?.(), []);

  const existingAudio = initial?.audio;
  function tryTone() {
    stopPreview.current?.();
    void unlockTone().then(() => {
      const stop = startTone(tone);
      stopPreview.current = stop;
      setTimeout(() => { stop(); if (stopPreview.current === stop) stopPreview.current = null; }, 2600);
    });
  }
  async function save() {
    if (!title.trim()) return setErr("Đặt tên cho báo thức nhé");
    if (sel.length === 0) return setErr("Chọn ít nhất một bé");
    if (mode === "rec" && !take && !existingAudio) return setErr("Bấm ghi âm lời nhắc trước, hoặc chọn cách khác nhé");
    if (mode === "text" && !body.trim()) return setErr("Viết lời nhắc cho máy đọc nhé");
    setErr(""); setBusy(true);
    const ok = await A.saveAlarm({
      id: initial?.id, title, at, repeat, kids: sel.length === kids.length ? undefined : sel, tone,
      body: mode === "text" ? body.trim() : "", voice, audio: mode === "rec" ? existingAudio : undefined, enabled: initial?.enabled ?? true,
    }, mode === "rec" && take ? take : undefined, existingAudio?.path);
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h3>{initial ? "Sửa báo thức" : "Thêm báo thức"}</h3>
      <label className="lbl">Tên báo thức
        <input className="field" name="title" maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Dậy đi học" />
      </label>
      <label className="lbl">Giờ kêu
        <input className="field" type="time" name="at" value={at} onChange={(e) => setAt(e.target.value)} />
      </label>
      <div className="lbl">Lặp lại vào<RepeatPicker value={repeat} onChange={setRepeat} /></div>
      <div className="lbl">Báo cho bé
        <div role="group" aria-label="Chọn bé" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {kids.map((k) => {
            const on = sel.includes(k.id);
            return (
              <button key={k.id} type="button" aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== k.id) : [...sel, k.id])}
                style={{ minHeight: 44, padding: "4px 14px", borderRadius: 999, fontWeight: 800, border: `2.5px solid ${on ? "var(--ink)" : "var(--sand)"}`, background: on ? "var(--mint-soft)" : "#fff" }}>
                {on && <Icon name="check" size={14} strokeWidth={3.6} />} {k.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="lbl">Tiếng chuông
        <ChipSelect label="Tiếng chuông" value={tone} onChange={setTone} options={TONES.map((t) => ({ value: t.id, label: t.name }))} />
        <button type="button" className="btn sm" onClick={tryTone}><Icon name="play" size={16} strokeWidth={3} />Nghe thử chuông</button>
      </div>
      <div className="lbl">Lời nhắc sau chuông
        <ChipSelect label="Lời nhắc" value={mode} onChange={setMode} options={[
          { value: "rec", label: "Ghi âm giọng của mình" }, { value: "text", label: "Viết chữ, giọng AI đọc" }, { value: "none", label: "Chỉ có chuông" },
        ]} />
      </div>
      {mode === "rec" && (
        <>
          {existingAudio && !take && (
            <div className="row" style={{ gap: 8 }}>
              <span className="muted grow">Đang dùng bản ghi âm {fmtSecs(existingAudio.secs)}. Ghi lại bên dưới để thay.</span>
              <ListenButton text="" audio={existingAudio} label="Nghe" />
            </div>
          )}
          <VoiceRecorder take={take} onTake={setTake} />
        </>
      )}
      {mode === "text" && (
        <>
          <label className="lbl">Lời nhắc
            <textarea className="field" name="body" rows={3} maxLength={400} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ví dụ: Dậy thôi con ơi, 6 giờ 50 rồi, đi đánh răng rửa mặt nào!" style={{ resize: "vertical", fontFamily: "inherit" }} />
          </label>
          <div className="lbl">Giọng đọc
            <ChipSelect label="Giọng đọc" value={voice} onChange={setVoice} options={[{ value: "f", label: "Giọng nữ" }, { value: "m", label: "Giọng nam" }]} />
          </div>
          {body.trim() && <ListenButton text={body} voice={voice} label="Nghe thử lời nhắc" />}
        </>
      )}
      {err && <div role="alert" style={{ color: "#C2185B", fontWeight: 800, fontSize: 13 }}>{err}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn mint grow" type="submit" disabled={busy}><Icon name="check" size={18} strokeWidth={3.4} />{busy ? "Đang lưu..." : "Lưu báo thức"}</button>
        <button className="btn" type="button" onClick={onDone} disabled={busy}>Huỷ</button>
      </div>
    </form>
  );
}

export function AlarmsTab() {
  const { S, A } = useApp();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<Alarm | null>(null);
  const kids = S.members.filter((m) => m.role === "kid");

  const who = (a: Alarm) => (!a.kids || a.kids.length === kids.length ? "tất cả các bé" : kids.filter((k) => a.kids!.includes(k.id)).map((k) => k.name).join(", "));
  return (
    <div className="plan stack">
      <div>
        <h2>Báo thức</h2>
        <div className="muted" style={{ marginTop: 4 }}>Đúng giờ, chuông kêu trên máy của bé rồi phát lời bố mẹ ghi âm để gọi các con dậy. Máy cả nhà cũng nhận thông báo đúng giờ đó.</div>
      </div>
      {adding ? <AlarmForm onDone={() => setAdding(false)} /> : (
        <button className="btn mint" onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" size={18} strokeWidth={3} />Thêm báo thức</button>
      )}
      {S.alarms.length === 0 && !adding && <Empty title="Chưa có báo thức nào" hint="Ví dụ: 6:50 mỗi sáng đi học, bố ghi âm lời gọi dậy, chuông kêu rồi giọng bố nhắc con." />}
      <div className="stack" style={{ gap: 10 }}>
        {S.alarms.map((a) => editing === a.id ? (
          <AlarmForm key={a.id} initial={a} onDone={() => setEditing(null)} />
        ) : (
          <div key={a.id} className="card row flat" style={{ gap: 10, padding: "10px 12px", opacity: a.enabled ? 1 : 0.6, flexWrap: "wrap" }}>
            <div className="display" style={{ fontSize: 30, minWidth: 74 }}>{fmtAt(a.at)}</div>
            <div className="grow" style={{ minWidth: 140 }}>
              <b style={{ fontSize: 15 }}>{a.title}</b>
              <div className="muted" style={{ fontSize: 12 }}>
                {repeatLabel(a.repeat)} · {who(a)} · {toneName(a.tone)} · {a.audio ? `ghi âm ${fmtSecs(a.audio.secs)}` : a.body ? "giọng AI đọc" : "chỉ chuông"}
              </div>
            </div>
            <label className="lbl check" style={{ minHeight: 44 }}>
              <input type="checkbox" checked={a.enabled} aria-label={`Bật báo thức ${a.title}`} onChange={(e) => void A.toggleAlarm(a.id, e.target.checked)} />
              Bật
            </label>
            <button className="btn sm" aria-label={`Thử chuông ${a.title}`} onClick={() => setPreview(a)}><Icon name="bell" size={16} />Thử</button>
            <button className="btn sm" aria-label={`Sửa ${a.title}`} onClick={() => { setEditing(a.id); setAdding(false); }}><Icon name="pencil" size={16} /></button>
            <button className="btn sm" aria-label={`Xoá ${a.title}`} onClick={() => { if (window.confirm(`Xoá báo thức "${a.title}"?`)) void A.deleteAlarm(a.id); }}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
      {preview && <AlarmRinger alarm={preview} who="các con" preview onDone={() => setPreview(null)} />}
    </div>
  );
}
