"use client";

import { useState } from "react";
import { Coin } from "@/components/Coin";
import { Icon } from "@/components/Icon";
import { DOW_SHORT, SLOT_SHORT, addDays, assigneeLabel, dowIdx, mem, repeatLabel, taskOnDay, today } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { Task, Who } from "@/lib/types";
import { TaskForm } from "./forms";

const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const GROUPS: [Who, string][] = [["kid", "Việc của các con"], ["together", "Làm cùng nhau"], ["parent", "Checklist của bố mẹ (con chấm)"]];

/** Kế hoạch theo ngày: bố mẹ chọn việc nào con làm vào ngày nào. Việc có lịch lặp tự hiện đúng thứ. */
export function PlanTab() {
  const { S, A } = useApp();
  const t0 = today();
  const [day, setDay] = useState(t0);
  const [adding, setAdding] = useState(false);

  const days = Array.from({ length: 15 }, (_, i) => addDays(t0, i - 1)); // hôm qua → 13 ngày tới
  const name = (d: string) => (d === t0 ? "Hôm nay" : d === addDays(t0, 1) ? "Ngày mai" : d === addDays(t0, -1) ? "Hôm qua" : DOW_SHORT[dowIdx(d)]);
  const past = day < t0;
  const on = (t: Task) => taskOnDay(S, t, day);
  const count = (d: string) => S.tasks.filter((t) => taskOnDay(S, t, d)).length;

  const planned = S.tasks.filter(on);
  const kidPlanned = planned.filter((t) => t.who !== "parent");
  const totalCoins = kidPlanned.reduce((a, t) => a + t.coins, 0);

  /** Ai đã được gật đầu cho việc này trong ngày đang xem */
  const doneBy = (t: Task) => S.subs.filter((s) => s.date === day && s.task === t.id && s.status === "approved").map((s) => mem(S, s.member).name);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <h2>Kế hoạch ngày</h2>
        <div className="muted">Chọn việc con cần làm trong từng ngày. Việc có lịch lặp tự hiện đúng thứ, bạn chỉ chỉnh khi hôm đó khác thường.</div>
      </div>

      <div className="tabs" role="tablist" aria-label="Chọn ngày">
        {days.map((d) => (
          <button key={d} role="tab" aria-selected={d === day} onClick={() => { setDay(d); setAdding(false); }}
            className={`btn sm ${d === day ? "coin" : ""}`} style={{ flexDirection: "column", gap: 0, minWidth: 64, padding: "2px 10px", lineHeight: 1.15 }}>
            <span>{name(d)}</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{dm(d)} · {count(d)} việc</span>
          </button>
        ))}
      </div>

      <div className="card row" style={{ background: "var(--coin-soft)", flexWrap: "wrap" }}>
        <b className="grow">{name(day)}, {DOW_SHORT[dowIdx(day)]} {dm(day)}: {kidPlanned.length} việc cho con</b>
        <span className="row" style={{ gap: 4 }}><Coin size={20} /><b>tối đa {totalCoins} Ủn</b></span>
      </div>

      {past && <div className="muted">Ngày đã qua nên chỉ để xem, không sửa được.</div>}
      {!past && (
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => A.copyPlan(addDays(day, -1), day)}><Icon name="undo" size={15} strokeWidth={3} />Giống {day === t0 ? "hôm qua" : "ngày trước"}</button>
          <button className="btn sm" onClick={() => A.setAllPlan(day, true)}>Chọn hết</button>
          <button className="btn sm" onClick={() => A.setAllPlan(day, false)}>Bỏ hết</button>
          <button className="btn sm mint" onClick={() => setAdding((v) => !v)} aria-expanded={adding}><Icon name="plus" size={15} strokeWidth={3} />Việc mới chỉ cho ngày này</button>
        </div>
      )}

      {adding && !past && (
        <TaskForm
          members={S.members}
          forDayLabel={`${name(day).toLowerCase()} (${dm(day)})`}
          onSave={async (v) => { const ok = await A.addTaskForDay(v, day); if (ok) setAdding(false); return ok; }}
          onCancel={() => setAdding(false)}
        />
      )}

      {S.tasks.length === 0 && <div className="card">Chưa có việc nào trong kho. Thêm ở tab &quot;Việc tốt&quot; hoặc bấm &quot;Việc mới chỉ cho ngày này&quot;.</div>}

      <div className="parent-grid">
        {GROUPS.map(([who, title]) => {
          const list = S.tasks.filter((t) => t.who === who);
          if (!list.length) return null;
          return (
            <section key={who} className="stack" style={{ gap: 8 }}>
              <h3>{title}</h3>
              {list.map((t) => {
                const checked = on(t);
                const done = doneBy(t);
                return (
                  <label key={t.id} className="card row" style={{ padding: "8px 10px", cursor: past ? "default" : "pointer", background: checked ? "var(--mint-soft)" : "var(--white)", opacity: past && !checked ? 0.6 : 1 }}>
                    <input
                      type="checkbox" checked={checked} disabled={past} aria-label={`${t.title}: làm vào ${name(day).toLowerCase()}`}
                      onChange={(e) => A.togglePlan(day, t.id, e.target.checked)}
                      style={{ width: 26, height: 26, accentColor: "#0F9D85", flexShrink: 0 }}
                    />
                    <div className="icon-box" style={{ width: 34, height: 34, background: t.bg }}><Icon name={t.icon} size={18} /></div>
                    <div className="grow">
                      <b style={{ fontSize: 14 }}>{t.title}</b>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {SLOT_SHORT[t.slot]} · +{t.coins} Ủn · {repeatLabel(t.repeat)}
                        {` · giao ${assigneeLabel(S, t)}`}
                      </div>
                    </div>
                    {done.length > 0 && <span className="pill" style={{ background: "var(--mint)" }}><Icon name="check" size={12} strokeWidth={3.6} />{done.join(", ")}</span>}
                  </label>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
