"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { DOW_SHORT, SLOT_SHORT, addDays, dowIdx, isOverdue, mem, myTasks, timeInfo, today } from "@/lib/data";
import { useApp } from "@/lib/store";
import { Avatar, Empty } from "./common";
import { TaskForm, saveNewTask } from "./forms";

const dm = (ymd: string) => `${Number(ymd.slice(8, 10))}/${Number(ymd.slice(5, 7))}`;
/** "Việc của tôi": checklist riêng của bố/mẹ đang đăng nhập, có hạn hoàn thành, tự tick xong, không cần ứng dụng khác */
export function MineTab() {
  const { S, U, A } = useApp();
  const me = U.member!;
  const t0 = today();
  const [day, setDay] = useState(t0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const list = myTasks(S, me, day);
  const isDone = (id: string) => S.subs.some((s) => s.member === me && s.task === id && s.date === day && s.status === "approved");
  const mine = list.filter((t) => t.selfCheck);
  const judged = list.filter((t) => !t.selfCheck);
  const done = mine.filter((t) => isDone(t.id)).length;
  const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
  const editable = day === t0; // chỉ đánh dấu xong cho hôm nay
  const dayName = day === t0 ? "Hôm nay" : day === addDays(t0, 1) ? "Ngày mai" : day === addDays(t0, -1) ? "Hôm qua" : DOW_SHORT[dowIdx(day)];

  return (
    <div className="plan stack">
      <div className="row" style={{ gap: 12 }}>
        <Avatar m={mem(S, me)} size={44} fs={18} />
        <div className="grow">
          <h2>Việc của {mem(S, me).name}</h2>
          <div className="muted">Checklist riêng của bạn. Tự tick khi xong, có hạn hoàn thành, không cần con chấm.</div>
        </div>
      </div>

      <div className="card plan-week">
        <div className="row between">
          <button className="btn sm" aria-label="Ngày trước" disabled={day <= addDays(t0, -1)} onClick={() => setDay(addDays(day, -1))}>
            <Icon name="back" size={16} strokeWidth={3} />
          </button>
          <div style={{ textAlign: "center" }}>
            <div className="display" style={{ fontSize: 18 }}>{dayName}</div>
            <div className="muted" style={{ fontSize: 12 }}>{DOW_SHORT[dowIdx(day)]} {dm(day)}</div>
          </div>
          <button className="btn sm" aria-label="Ngày sau" disabled={day >= addDays(t0, 14)} onClick={() => setDay(addDays(day, 1))}>
            <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="back" size={16} strokeWidth={3} /></span>
          </button>
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 10 }} role="group" aria-label="Nhảy nhanh">
          <button className="btn sm" aria-pressed={day === t0} onClick={() => setDay(t0)}>Hôm nay</button>
          <button className="btn sm" aria-pressed={day === addDays(t0, 1)} onClick={() => setDay(addDays(t0, 1))}>Ngày mai</button>
        </div>
      </div>

      {adding ? (
        <TaskForm
          members={S.members}
          defaultKind="once"
          defaultDay={day}
          defaultAssign={[me]}
          onSave={async (v, o) => { const ok = await saveNewTask(A, v, o); if (ok) setAdding(false); return ok; }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="btn mint" onClick={() => setAdding(true)}><Icon name="plus" size={18} strokeWidth={3} />Thêm việc</button>
      )}

      <section className="plan-section">
        <header className="plan-section-head">
          <span className="plan-section-icon"><Icon name="check" size={18} /></span>
          <div className="grow">
            <h3>Việc cần làm</h3>
            <div className="muted" style={{ fontSize: 12 }}>{mine.length ? `${done}/${mine.length} xong` : "Chưa có việc nào"}{!editable && mine.length ? " · chỉ tick được cho hôm nay" : ""}</div>
          </div>
          {mine.length > 0 && <span className="pill" style={{ background: done === mine.length ? "var(--mint)" : "var(--sand)" }}>{pct}%</span>}
        </header>
        {mine.length > 0 && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
        <div className="plan-rows">
          {mine.length === 0 && <Empty title="Chưa có việc riêng nào" hint="Bấm &quot;Thêm việc&quot; để ghi việc của bạn: có hạn hoàn thành, tự tick khi xong." />}
          {mine.map((t) => {
            const ok = isDone(t.id);
            const late = isOverdue(t, day, ok);
            if (editing === t.id) {
              return <TaskForm key={t.id} initial={t} members={S.members} onSave={(v) => A.updateTask(t.id, v)} onCancel={() => setEditing(null)} />;
            }
            return (
              <div key={t.id} className={`plan-row ${ok ? "on" : ""}`} style={late ? { borderColor: "#B91C1C" } : undefined}>
                <input type="checkbox" checked={ok} disabled={!editable} aria-label={`${t.title}: đã xong`} onChange={() => A.selfToggle(t.id)} />
                <span className="grow">
                  <b className="plan-row-title" style={{ textDecoration: ok ? "line-through" : "none", opacity: ok ? 0.7 : 1 }}>{t.title}</b>
                  <span className="plan-row-meta2">
                    {SLOT_SHORT[t.slot]}{timeInfo(t) ? ` · ${timeInfo(t)}` : ""}{t.oneOff ? " · chỉ lần này" : ""}
                  </span>
                </span>
                {late && <span className="pill" style={{ background: "#FEE2E2", color: "#991B1B" }}>Quá hạn</span>}
                <button className="btn sm" aria-label={`Sửa ${t.title}`} onClick={() => { setEditing(t.id); setAdding(false); }}><Icon name="pencil" size={16} /></button>
                <button className="btn sm" aria-label={`Xoá ${t.title}`} onClick={() => { if (window.confirm(t.oneOff ? `Xoá việc "${t.title}"?` : `Xoá "${t.title}" khỏi kho việc? Việc sẽ biến mất ở mọi ngày.`)) void A.delTask(t.id); }}><Icon name="trash" size={16} /></button>
              </div>
            );
          })}
        </div>
      </section>

      {judged.length > 0 && (
        <section className="plan-section">
          <header className="plan-section-head">
            <span className="plan-section-icon"><Icon name="star" size={18} /></span>
            <div className="grow">
              <h3>Việc con chấm cho bạn</h3>
              <div className="muted" style={{ fontSize: 12 }}>Các con chấm Đạt trong giờ Ủn Ỉn</div>
            </div>
          </header>
          <div className="plan-rows">
            {judged.map((t) => {
              const ok = isDone(t.id);
              return (
                <div key={t.id} className={`plan-row ${ok ? "on" : ""}`}>
                  <span className="grow">
                    <b className="plan-row-title">{t.title}</b>
                    <span className="plan-row-meta2">{SLOT_SHORT[t.slot]} · +{t.coins} Ủn</span>
                  </span>
                  {ok ? <span className="pill" style={{ background: "var(--mint)" }}><Icon name="check" size={12} strokeWidth={3.6} />Con chấm đạt</span> : <span className="pill" style={{ background: "var(--sand)" }}>Chờ con chấm</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
