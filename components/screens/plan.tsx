"use client";

import { useState } from "react";
import { Coin } from "@/components/Coin";
import { Icon, type IconName } from "@/components/Icon";
import { weekStartOf } from "@/lib/backend";
import { DOW_SHORT, SLOT_SHORT, addDays, assigneeLabel, dowIdx, mem, repeatLabel, taskOnDay, today } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { Task, Who } from "@/lib/types";
import { TaskForm } from "./forms";

const dm = (ymd: string) => `${Number(ymd.slice(8, 10))}/${Number(ymd.slice(5, 7))}`;
const DOW_LONG = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const SECTIONS: { who: Who; title: string; icon: IconName; hint: string }[] = [
  { who: "kid", title: "Việc của các con", icon: "star", hint: "Con tự làm, bố mẹ gật đầu" },
  { who: "together", title: "Làm cùng nhau", icon: "heart", hint: "Con và bố mẹ cùng nhận Ủn" },
  { who: "parent", title: "Checklist của bố mẹ", icon: "check", hint: "Các con chấm Đạt" },
];
const MIN_WEEK = -1, MAX_WEEK = 2;

/** Kế hoạch theo ngày: bố mẹ chọn việc nào con làm vào ngày nào. Việc có lịch lặp tự hiện đúng thứ. */
export function PlanTab() {
  const { S, A } = useApp();
  const t0 = today();
  const [week, setWeek] = useState(0);
  const [day, setDay] = useState(t0);
  const [adding, setAdding] = useState(false);

  const start = weekStartOf(week, t0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const past = day < t0;
  const on = (t: Task) => taskOnDay(S, t, day);
  const count = (d: string) => S.tasks.filter((t) => t.who !== "parent" && taskOnDay(S, t, d)).length;

  const kidPlanned = S.tasks.filter((t) => t.who !== "parent" && on(t));
  const totalCoins = kidPlanned.reduce((a, t) => a + t.coins, 0);
  const dayName = day === t0 ? "Hôm nay" : day === addDays(t0, 1) ? "Ngày mai" : day === addDays(t0, -1) ? "Hôm qua" : DOW_LONG[dowIdx(day)];

  /** Nhảy tới một ngày, tự chuyển sang tuần chứa ngày đó */
  const jumpTo = (target: string) => {
    const w = Math.round((Date.parse(weekStartOf(0, target)) - Date.parse(weekStartOf(0, t0))) / (7 * 86400000));
    setWeek(Math.min(MAX_WEEK, Math.max(MIN_WEEK, w)));
    setDay(target);
    setAdding(false);
  };
  const goWeek = (w: number) => {
    setWeek(w);
    setAdding(false);
    const s = weekStartOf(w, t0);
    setDay(w === 0 ? t0 : s); // tuần này: về hôm nay; tuần khác: thứ Hai của tuần đó
  };

  /** Ai đã được gật đầu cho việc này trong ngày đang xem */
  const doneBy = (t: Task) => S.subs.filter((s) => s.date === day && s.task === t.id && s.status === "approved").map((s) => mem(S, s.member).name);

  return (
    <div className="plan stack">
      <div>
        <h2>Kế hoạch ngày</h2>
        <div className="muted" style={{ marginTop: 4 }}>Chọn việc con làm trong từng ngày. Việc có lịch lặp tự hiện đúng thứ; bạn chỉ chỉnh khi hôm đó khác thường.</div>
      </div>

      {/* Chọn tuần rồi chọn ngày: mỗi lần chỉ thấy 7 ngày */}
      <div className="card plan-week">
        <div className="row between">
          <button className="btn sm" aria-label="Tuần trước" disabled={week <= MIN_WEEK} onClick={() => goWeek(week - 1)}>
            <Icon name="back" size={16} strokeWidth={3} />
          </button>
          <div style={{ textAlign: "center" }}>
            <div className="display" style={{ fontSize: 17 }}>{week === 0 ? "Tuần này" : week === 1 ? "Tuần sau" : week === -1 ? "Tuần trước" : `Sau ${week} tuần`}</div>
            <div className="muted" style={{ fontSize: 12 }}>{dm(days[0])} – {dm(days[6])}</div>
          </div>
          <button className="btn sm" aria-label="Tuần sau" disabled={week >= MAX_WEEK} onClick={() => goWeek(week + 1)}>
            <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="back" size={16} strokeWidth={3} /></span>
          </button>
        </div>

        <div className="plan-days" role="tablist" aria-label="Chọn ngày">
          {days.map((d) => {
            const sel = d === day, isToday = d === t0, n = count(d);
            return (
              <button key={d} role="tab" aria-selected={sel} aria-label={`${DOW_LONG[dowIdx(d)]} ${dm(d)}, ${n} việc cho con${isToday ? ", hôm nay" : ""}`}
                onClick={() => { setDay(d); setAdding(false); }} className={`plan-day ${sel ? "on" : ""}`}>
                <span className="plan-day-dow">{DOW_SHORT[dowIdx(d)]}</span>
                <span className="plan-day-num">{Number(d.slice(8, 10))}</span>
                <span className={`plan-day-count ${n === 0 ? "zero" : ""}`}>{n}</span>
                {isToday && <span className="plan-day-today" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 10 }} role="group" aria-label="Nhảy nhanh">
          <button className="btn sm" aria-pressed={day === t0} onClick={() => jumpTo(t0)}>Hôm nay</button>
          <button className="btn sm" aria-pressed={day === addDays(t0, 1)} onClick={() => jumpTo(addDays(t0, 1))}>Ngày mai</button>
        </div>
      </div>

      {/* Tóm tắt ngày đang chọn */}
      <div className="card plan-summary">
        <div className="grow">
          <div className="display" style={{ fontSize: 19 }}>{dayName}, {dm(day)}</div>
          <div className="muted">{kidPlanned.length} việc cho con</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}><Coin size={22} /><b className="display" style={{ fontSize: 22 }}>{totalCoins}</b></div>
          <div className="muted" style={{ fontSize: 12 }}>Ủn tối đa mỗi bé</div>
        </div>
      </div>

      {past ? (
        <div className="muted">Ngày đã qua nên chỉ để xem, không sửa được.</div>
      ) : (
        <div className="plan-actions">
          <button className="btn mint" onClick={() => setAdding((v) => !v)} aria-expanded={adding}><Icon name="plus" size={18} strokeWidth={3} />Việc mới cho ngày này</button>
          <div className="plan-quick" role="group" aria-label="Thao tác nhanh">
            <button className="btn sm ghost" onClick={() => A.copyPlan(addDays(day, -1), day)}><Icon name="undo" size={15} strokeWidth={3} />Giống ngày trước</button>
            <button className="btn sm ghost" onClick={() => A.setAllPlan(day, true)}>Chọn hết</button>
            <button className="btn sm ghost" onClick={() => A.setAllPlan(day, false)}>Bỏ hết</button>
          </div>
        </div>
      )}

      {adding && !past && (
        <TaskForm
          members={S.members}
          forDayLabel={`${dayName.toLowerCase()} (${dm(day)})`}
          onSave={async (v) => { const ok = await A.addTaskForDay(v, day); if (ok) setAdding(false); return ok; }}
          onCancel={() => setAdding(false)}
        />
      )}

      {S.tasks.length === 0 && <div className="card">Chưa có việc nào trong kho. Thêm ở tab &quot;Việc tốt&quot; hoặc bấm &quot;Việc mới cho ngày này&quot;.</div>}

      <div className="plan-lists">
        {SECTIONS.map(({ who, title, icon, hint }) => {
          const list = S.tasks.filter((t) => t.who === who);
          if (!list.length) return null;
          const chosen = list.filter(on).length;
          return (
            <section key={who} className="plan-section">
              <header className="plan-section-head">
                <span className="plan-section-icon"><Icon name={icon} size={18} /></span>
                <div className="grow">
                  <h3>{title}</h3>
                  <div className="muted" style={{ fontSize: 12 }}>{hint}</div>
                </div>
                <span className="pill" style={{ background: chosen ? "var(--mint-soft)" : "var(--sand)" }}>{chosen}/{list.length}</span>
              </header>
              <div className="plan-rows">
                {list.map((t) => {
                  const checked = on(t);
                  const done = doneBy(t);
                  return (
                    <label key={t.id} className={`plan-row ${checked ? "on" : ""}`} style={{ cursor: past ? "default" : "pointer", opacity: past && !checked ? 0.55 : 1 }}>
                      <input type="checkbox" checked={checked} disabled={past} aria-label={`${t.title}: làm vào ${dayName.toLowerCase()}`} onChange={(e) => A.togglePlan(day, t.id, e.target.checked)} />
                      <span className="icon-box" style={{ width: 38, height: 38, background: t.bg }}><Icon name={t.icon} size={20} /></span>
                      <span className="grow">
                        <b className="plan-row-title">{t.title}</b>
                        <span className="plan-row-meta">{SLOT_SHORT[t.slot]} · +{t.coins} Ủn</span>
                        <span className="plan-row-meta2">{repeatLabel(t.repeat)} · giao {assigneeLabel(S, t)}</span>
                      </span>
                      {done.length > 0 && <span className="pill" style={{ background: "var(--mint)" }}><Icon name="check" size={12} strokeWidth={3.6} />{done.join(", ")}</span>}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
